/**
 * Automatické publikování přes tvůj normální prohlížeč (Chrome / Edge).
 * Každý účet má vlastní profil v data/profiles/<id> – jednou se v něm přihlásíš
 * a Studio pak nahrává videa za tebe (ovládá okno přes Chrome DevTools Protocol).
 *
 * Weby TikToku, Instagramu i YouTube se občas mění. Když automatika nějaký krok
 * nenajde, okno nechá otevřené – dokončíš ho kliknutím a ve Studiu dáš
 * „Označit jako publikované“.
 */
import {spawn, type ChildProcess} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {chromium, type Browser, type Locator, type Page} from 'playwright-core';
import {DATA, type Channel, type Platform} from './store';

export const LOGIN_URL: Record<Platform, string> = {
  tiktok: 'https://www.tiktok.com/login',
  instagram: 'https://www.instagram.com/accounts/login/',
  youtube: 'https://studio.youtube.com/',
};

/** Najde nainstalovaný Chrome nebo Edge. */
export const findBrowser = (): string | null => {
  const env = process.env.BROWSER_PATH;
  if (env && fs.existsSync(env)) return env;
  const pf = process.env['PROGRAMFILES'] || 'C:\\Program Files';
  const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(pf86, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ];
  return candidates.find((c) => c && fs.existsSync(c)) ?? null;
};

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });

const profileDir = (ch: Channel) => path.join(DATA, 'profiles', ch.id.replace(/[^\w-]/g, '_'));

const running = new Map<string, {proc: ChildProcess; port: number}>();

/** Otevře okno prohlížeče s profilem účtu (pro přihlášení nebo publikování). */
export const openBrowser = async (ch: Channel, url: string) => {
  const exe = findBrowser();
  if (!exe) throw new Error('Nenašel jsem Chrome ani Edge. Nainstaluj Google Chrome, nebo nastav BROWSER_PATH v .env.');
  const prev = running.get(ch.id);
  if (prev && prev.proc.exitCode === null) {
    return prev;
  }
  const port = await freePort();
  const dir = profileDir(ch);
  fs.mkdirSync(dir, {recursive: true});
  const proc = spawn(exe, [`--user-data-dir=${dir}`, `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', url], {
    detached: false,
    stdio: 'ignore',
  });
  running.set(ch.id, {proc, port});
  proc.on('exit', () => running.delete(ch.id));
  return {proc, port};
};

const connect = async (port: number): Promise<Browser> => {
  for (let i = 0; i < 40; i++) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Nepodařilo se připojit k oknu prohlížeče.');
};

/* ---------- pomocné funkce pro klikání ---------- */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

const firstVisible = async (page: Page, locators: Locator[], timeout = 15000): Promise<Locator | null> => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    for (const l of locators) {
      const n = await l.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const el = l.nth(i);
        if (await el.isVisible().catch(() => false)) return el;
      }
    }
    await sleep(400);
  }
  return null;
};

const clickButton = async (page: Page, name: RegExp, timeout = 15000) => {
  const el = await firstVisible(page, [page.getByRole('button', {name}), page.locator('button, [role=button]').filter({hasText: name})], timeout);
  if (!el) return false;
  await el.click();
  return true;
};

const fillEditable = async (page: Page, el: Locator, text: string) => {
  await el.click();
  await page.keyboard.press(`${MOD}+A`);
  await page.keyboard.press('Backspace');
  // po řádcích – Enter v editorech dělá nový řádek
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) await page.keyboard.insertText(lines[i]);
    if (i < lines.length - 1) await page.keyboard.press('Shift+Enter');
  }
};

const setFile = async (page: Page, file: string, timeout = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    for (const frame of page.frames()) {
      const input = frame.locator('input[type=file]');
      if ((await input.count().catch(() => 0)) > 0) {
        await input.first().setInputFiles(file);
        return;
      }
    }
    await sleep(500);
  }
  throw new Error('Nenašel jsem tlačítko pro nahrání souboru.');
};

export type PostInput = {file: string; title: string; description: string; hashtags: string[]};

/* ---------- YouTube Shorts ---------- */
const postYouTube = async (page: Page, v: PostInput) => {
  await page.goto('https://www.youtube.com/upload', {waitUntil: 'domcontentloaded'});
  if (/accounts\.google\.com/.test(page.url())) throw new Error('Nejsi přihlášen do YouTube – klikni u účtu na „Přihlásit“.');
  await setFile(page, v.file, 60000);
  const title = await firstVisible(page, [page.locator('#title-textarea #textbox'), page.locator('ytcp-social-suggestions-textbox#title-textarea [contenteditable]')], 60000);
  if (!title) throw new Error('YouTube: nenašel jsem pole pro název.');
  await fillEditable(page, title, `${v.title} #shorts`.slice(0, 100));
  const desc = await firstVisible(page, [page.locator('#description-textarea #textbox')], 10000);
  if (desc) await fillEditable(page, desc, `${v.description}\n\n${v.hashtags.map((h) => `#${h}`).join(' ')} #shorts`);
  const notKids = await firstVisible(page, [page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]'), page.locator('[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]')], 10000);
  if (notKids) await notKids.click();
  for (let i = 0; i < 3; i++) {
    const next = await firstVisible(page, [page.locator('#next-button')], 15000);
    if (!next) throw new Error('YouTube: nenašel jsem tlačítko Další.');
    await next.click();
    await sleep(1500);
  }
  const pub = await firstVisible(page, [page.locator('tp-yt-paper-radio-button[name="PUBLIC"]'), page.locator('[name="PUBLIC"]')], 15000);
  if (!pub) throw new Error('YouTube: nenašel jsem volbu Veřejné.');
  await pub.click();
  // počkej, až se soubor dohraje (text průběhu přestane obsahovat procenta)
  const t0 = Date.now();
  while (Date.now() - t0 < 15 * 60000) {
    const txt = (await page.locator('ytcp-video-upload-progress').first().innerText().catch(() => '')) || '';
    if (txt && !/\d+\s?%/.test(txt)) break;
    await sleep(2000);
  }
  const done = await firstVisible(page, [page.locator('#done-button')], 15000);
  if (!done) throw new Error('YouTube: nenašel jsem tlačítko Publikovat.');
  await done.click();
  const ok = await firstVisible(page, [page.locator('ytcp-video-share-dialog'), page.locator('#close-button')], 120000);
  if (!ok) throw new Error('YouTube: nepotvrdil publikování.');
};

/* ---------- TikTok ---------- */
const postTikTok = async (page: Page, v: PostInput) => {
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp', {waitUntil: 'domcontentloaded'});
  if (/\/login/.test(page.url())) throw new Error('Nejsi přihlášen do TikToku – klikni u účtu na „Přihlásit“.');
  await setFile(page, v.file, 60000);
  const editor = await firstVisible(page, [page.locator('.public-DraftEditor-content'), page.locator('div[contenteditable="true"]')], 90000);
  if (!editor) throw new Error('TikTok: nenašel jsem pole pro popisek.');
  await fillEditable(page, editor, `${v.title}\n${v.description}\n`);
  for (const h of v.hashtags.slice(0, 6)) {
    await page.keyboard.type(`#${h}`, {delay: 40});
    await sleep(900);
    await page.keyboard.press('Space');
    await sleep(300);
  }
  await page.keyboard.press('Escape').catch(() => {});
  // tlačítko Zveřejnit je aktivní až po nahrání
  const btn = page.locator('button[data-e2e="post_video_button"]');
  const t0 = Date.now();
  let clicked = false;
  while (Date.now() - t0 < 10 * 60000) {
    if ((await btn.count()) > 0) {
      const disabled = (await btn.first().getAttribute('aria-disabled')) === 'true' || (await btn.first().isDisabled());
      if (!disabled) {
        await btn.first().click();
        clicked = true;
        break;
      }
    } else if (await clickButton(page, /^(Post|Publikovat|Zveřejnit|Postează)$/i, 1000)) {
      clicked = true;
      break;
    }
    await sleep(2000);
  }
  if (!clicked) throw new Error('TikTok: tlačítko Zveřejnit se neaktivovalo.');
  // případné potvrzovací okno
  await clickButton(page, /^(Post now|Publikovat hned|Zveřejnit hned|Postează acum)$/i, 5000);
  const t1 = Date.now();
  while (Date.now() - t1 < 120000) {
    if (/tiktokstudio\/content|\/manage/.test(page.url())) return;
    const toast = await page.getByText(/(posted|uploaded|zveřejněn|publikován|nahrán|publicat)/i).count().catch(() => 0);
    if (toast) return;
    await sleep(2000);
  }
  throw new Error('TikTok: nepotvrdil zveřejnění.');
};

/* ---------- Instagram Reels ---------- */
const postInstagram = async (page: Page, v: PostInput) => {
  await page.goto('https://www.instagram.com/', {waitUntil: 'domcontentloaded'});
  await sleep(3000);
  if (/accounts\/login/.test(page.url())) throw new Error('Nejsi přihlášen do Instagramu – klikni u účtu na „Přihlásit“.');
  const create = await firstVisible(
    page,
    [page.locator('svg[aria-label="New post"], svg[aria-label="Create"], svg[aria-label="Nový příspěvek"], svg[aria-label="Vytvořit"], svg[aria-label="Postare nouă"], svg[aria-label="Creează"]')],
    20000,
  );
  if (!create) throw new Error('Instagram: nenašel jsem tlačítko Vytvořit.');
  await create.click();
  await sleep(1200);
  // podnabídka "Příspěvek"
  await clickButton(page, /^(Post|Příspěvek|Postare)$/i, 3000);
  const t0 = Date.now();
  await setFile(page, v.file, 30000);
  await clickButton(page, /^(OK)$/i, 4000); // "Video se teď sdílí jako reel"
  // ořez: zvolit originál / 9:16
  const crop = await firstVisible(page, [page.locator('svg[aria-label="Select crop"], svg[aria-label="Vybrat oříznutí"], svg[aria-label="Selectează decuparea"]')], 15000);
  if (crop) {
    await crop.click();
    await sleep(600);
    const orig = await firstVisible(page, [page.getByText(/^(Original|Původní|Originală|9:16)$/i)], 4000);
    if (orig) await orig.click();
  }
  for (let i = 0; i < 2; i++) {
    if (!(await clickButton(page, /^(Next|Další|Înainte|Următorul)$/i, 30000))) throw new Error('Instagram: nenašel jsem tlačítko Další.');
    await sleep(2000);
  }
  const caption = await firstVisible(page, [page.locator('div[role=dialog] div[contenteditable="true"]'), page.locator('div[contenteditable="true"]')], 20000);
  if (!caption) throw new Error('Instagram: nenašel jsem pole pro popisek.');
  await fillEditable(page, caption, `${v.title}\n\n${v.description}\n\n${v.hashtags.map((h) => `#${h}`).join(' ')}`);
  if (!(await clickButton(page, /^(Share|Sdílet|Distribuie)$/i, 20000))) throw new Error('Instagram: nenašel jsem tlačítko Sdílet.');
  while (Date.now() - t0 < 8 * 60000) {
    const done = await page
      .getByText(/(reel has been shared|post has been shared|byl sdílen|byl zveřejněn|a fost distribuit|a fost publicat)/i)
      .count()
      .catch(() => 0);
    if (done) return;
    if (await page.locator('img[alt="Animated checkmark"], img[alt*="checkmark" i]').count().catch(() => 0)) return;
    await sleep(2500);
  }
  throw new Error('Instagram: nepotvrdil sdílení.');
};

const FLOWS: Record<Platform, (p: Page, v: PostInput) => Promise<void>> = {
  youtube: postYouTube,
  tiktok: postTikTok,
  instagram: postInstagram,
};

/** Publikuje video na kanál. Při chybě nechá okno otevřené a uloží snímek obrazovky. */
export const publish = async (ch: Channel, v: PostInput, log: (s: string) => void) => {
  const {port, proc} = await openBrowser(ch, 'about:blank');
  const browser = await connect(port);
  const ctx = browser.contexts()[0] ?? (await browser.newContext());
  const page = await ctx.newPage();
  try {
    log(`🌐 ${ch.name}: otevírám ${ch.platform}…`);
    await FLOWS[ch.platform](page, v);
    log(`✅ ${ch.name}: publikováno`);
    await sleep(5000);
    await browser.close().catch(() => {});
    proc.kill();
  } catch (e) {
    const shot = path.join(DATA, 'logs', `${ch.id}-${Date.now()}.png`);
    fs.mkdirSync(path.dirname(shot), {recursive: true});
    await page.screenshot({path: shot}).catch(() => {});
    // okno zůstává otevřené, ať to můžeš dokončit ručně
    await browser.close().catch(() => {}); // jen odpojí ovládání, okno běží dál
    throw e;
  }
};

/** Jen otevře okno pro přihlášení (zavři ho, až budeš přihlášený). */
export const openLogin = async (ch: Channel) => {
  await openBrowser(ch, LOGIN_URL[ch.platform]);
};
