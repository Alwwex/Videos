/**
 * Fyzika Studio – jedna aplikace na všechno:
 *   výroba videí (hlas + render), přehrávání, popisky, a automatické publikování
 *   na TikTok / Instagram / YouTube podle plánu (výchozí 2× denně).
 * Spuštění: dvojklik na "Spustit Studio.bat" (Windows) nebo  npm run studio
 * Okno: http://localhost:4321
 */
import {spawn, type ChildProcess} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {LANGS, type Lang} from '../src/engine/schema';
import {LANG_DIR, P, ROOT, allScriptIds, captionText, isHybrid, isShort, loadIdeas, loadScript, loadTimeline, pad, renderStale, videoOutFile, type AnyScript} from '../scripts/lib';
import {DEFAULT_VOICE, VOICE_CATALOG, findVoice} from '../scripts/voices';
import {findBrowser, openLogin, publish} from './publish';
import {DATA, load, save, update, type Channel, type Platform} from './store';

const PORT = Number(process.env.STUDIO_PORT || 4321);
const OUT = path.join(ROOT, 'out');
const ENV_FILE = path.join(ROOT, '.env');
const HTML_FILE = path.join(ROOT, 'studio', 'ui.html');

/* ============ log ============ */
const LOG: string[] = [];
const log = (line: string) => {
  const t = new Date().toLocaleTimeString('cs-CZ');
  LOG.push(`${t}  ${line}`);
  if (LOG.length > 400) LOG.splice(0, LOG.length - 400);
  console.log(line);
};

/* ============ úlohy (hlas / render / AI) ============ */
type Job = {id: number; label: string; steps: string[][]; status: 'queued' | 'running' | 'done' | 'failed' | 'stopped'};
const jobs: Job[] = [];
let jobSeq = 1;
let child: ChildProcess | null = null;
let stopRequested = false;

const runStep = (args: string[]) =>
  new Promise<number>((resolve) => {
    // node --import tsx skript.ts … (funguje stejně na Windows, macOS i Linuxu)
    const p = spawn(process.execPath, ['--import', 'tsx', ...args], {cwd: ROOT, env: process.env});
    child = p;
    let buf = '';
    const onData = (d: Buffer) => {
      buf += d.toString('utf8');
      const parts = buf.split(/\r|\n/);
      buf = parts.pop() ?? '';
      for (const raw of parts) {
        const line = raw.trim();
        if (!line || line.startsWith('🎬 Render [') || /memory|docker run|lower amount/i.test(line)) continue;
        log(line);
      }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('close', (code) => {
      child = null;
      resolve(code ?? 1);
    });
  });

const pumpJobs = async () => {
  if (jobs.some((j) => j.status === 'running')) return;
  const job = jobs.find((j) => j.status === 'queued');
  if (!job) return;
  job.status = 'running';
  stopRequested = false;
  log(`▶️ ${job.label}`);
  for (const step of job.steps) {
    const code = await runStep(step);
    if (stopRequested) {
      job.status = 'stopped';
      break;
    }
    if (code !== 0 && !step[0].includes('voice')) {
      job.status = 'failed';
      break;
    }
  }
  if (job.status === 'running') job.status = 'done';
  log(`${job.status === 'done' ? '🏁' : '⏹️'} ${job.label}: ${job.status}`);
  pumpJobs();
};

const addJob = (label: string, steps: string[][]) => {
  jobs.push({id: jobSeq++, label, steps, status: 'queued'});
  if (jobs.length > 50) jobs.splice(0, jobs.length - 50);
  pumpJobs();
};

const idsArg = (ids: number[]) => ids.join(',');

/* ============ stav videí ============ */
const audioOk = (id: number, lang: Lang) => {
  const tl = loadTimeline(id, lang) as (ReturnType<typeof loadTimeline> & {provider?: string; continuous?: boolean; audioSrc?: string | null; partial?: boolean}) | null;
  if (!tl || tl.partial) return {voiced: false, provider: null as string | null};
  const has = (rel: string | null | undefined) => !rel || fs.existsSync(path.join(ROOT, 'public', rel));
  const ok = tl.continuous ? !!tl.audioSrc && has(tl.audioSrc) : tl.scenes.every((s) => has(s.audioSrc));
  const outro = (tl as {outro?: {startSec?: number; audioSrc?: string | null} | null}).outro;
  return {voiced: ok, provider: ok ? (tl.provider ?? 'elevenlabs') : null, outro: !!outro && (outro.startSec !== undefined || has(outro.audioSrc))};
};

/** Video vyrenderované ještě do staré struktury out/videos/<lang>/NNN-….mp4 */
const oldRender = (id: number, lang: Lang) => {
  const dir = path.join(P.videos, lang);
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).find((x) => x.startsWith(`${pad(id)}-`) && x.endsWith('.mp4'));
  return f ? path.join(dir, f) : null;
};

const scriptCache = new Map<number, {mtime: number; s: AnyScript | null}>();
const getScript = (id: number) => {
  const f = path.join(P.scripts, `${pad(id)}.json`);
  const mtime = fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0;
  const c = scriptCache.get(id);
  if (c && c.mtime === mtime) return c.s;
  let s: AnyScript | null = null;
  try {
    s = loadScript(id);
  } catch (e) {
    log(`⚠️ Scénář #${id} je poškozený: ${(e as Error).message.slice(0, 100)}`);
  }
  scriptCache.set(id, {mtime, s});
  return s;
};

const videoList = () => {
  const st = load();
  return allScriptIds().flatMap((id) => {
    const s = getScript(id);
    if (!s) return [];
    // v jazyce, kde už video vyšlo, zůstává stejná verze i pro další sítě (render ho taky nepřepíše)
    const postedLangs = new Set(st.posts.filter((p) => p.videoId === id && p.status !== 'error').map((p) => st.channels.find((c) => c.id === p.channelId)?.lang));
    const langs = Object.fromEntries(
      LANGS.map((lang) => {
        const file = videoOutFile(s, lang);
        const rendered = fs.existsSync(file);
        return [lang, {...audioOk(id, lang), rendered, stale: rendered && !postedLangs.has(lang) ? renderStale(s, lang) : null, old: !rendered && !!oldRender(id, lang), size: rendered ? fs.statSync(file).size : 0}];
      }),
    );
    const posts = st.posts.filter((p) => p.videoId === id && p.status !== 'error').map((p) => p.channelId);
    const errors = st.posts.filter((p) => p.videoId === id && p.status === 'error').map((p) => ({channelId: p.channelId, message: p.message}));
    return [{id, title: s.title.cs, titles: s.title, engine: isHybrid(s) ? 'hybrid' : isShort(s) ? 'blueprint' : 'classic', scenes: s.scenes.length, langs, skip: !!st.skip[String(id)], posted: [...new Set(posts)], errors}];
  });
};

/* ============ kredity ============ */
let elevenCache: {at: number; value: number | null; limit: number | null} = {at: 0, value: null, limit: null};
const elevenCredits = async () => {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return {value: null, limit: null};
  if (Date.now() - elevenCache.at < 5 * 60000) return elevenCache;
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', {headers: {'xi-api-key': key}});
    if (r.ok) {
      const j = (await r.json()) as {character_count: number; character_limit: number};
      elevenCache = {at: Date.now(), value: Math.max(0, j.character_limit - j.character_count), limit: j.character_limit};
    } else elevenCache = {at: Date.now(), value: null, limit: null};
  } catch {
    elevenCache = {at: Date.now(), value: null, limit: null};
  }
  return elevenCache;
};
const aiSpent = () => {
  try {
    return (JSON.parse(fs.readFileSync(path.join(OUT, 'ai-usage.json'), 'utf8')) as {usd: number}[]).reduce((n, r) => n + r.usd, 0);
  } catch {
    return 0;
  }
};

/* ============ nastavení (.env) ============ */
const ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'AI_BUDGET_USD',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_CS',
  'ELEVENLABS_VOICE_EN',
  'ELEVENLABS_VOICE_RO',
  'VOICE_PROVIDER_CS',
  'VOICE_PROVIDER_EN',
  'VOICE_PROVIDER_RO',
  'EDGE_VOICE_CS',
  'EDGE_VOICE_EN',
  'EDGE_VOICE_RO',
  'BROWSER_PATH',
] as const;
const SECRET = new Set(['ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY']);

const readEnv = (): Record<string, string> => {
  if (!fs.existsSync(ENV_FILE)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
};
const writeEnv = (patch: Record<string, string>) => {
  const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/) : [];
  const seen = new Set<string>();
  const next = lines.map((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m && m[1] in patch) {
      seen.add(m[1]);
      return `${m[1]}=${patch[m[1]]}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(patch)) if (!seen.has(k)) next.push(`${k}=${v}`);
  fs.writeFileSync(ENV_FILE, next.join('\n').replace(/\n{3,}/g, '\n\n'));
  for (const [k, v] of Object.entries(patch)) {
    if (v) process.env[k] = v;
    else delete process.env[k];
  }
  elevenCache.at = 0;
};
if (fs.existsSync(ENV_FILE)) for (const [k, v] of Object.entries(readEnv())) if (!process.env[k]) process.env[k] = v;

/* ============ publikování ============ */
type PubTask = {channelId: string; videoId?: number; manual: boolean};
const pubQueue: PubTask[] = [];
let pubBusy: string | null = null;

const pickVideo = (ch: Channel): number | null => {
  const st = load();
  for (const v of videoList()) {
    if (st.skip[String(v.id)]) continue;
    // zastaralou verzi (starý vzhled / chybí závěr) nepublikovat – počká na přerenderování
    if (!v.langs[ch.lang]?.rendered || v.langs[ch.lang]?.stale) continue;
    if (st.posts.some((p) => p.channelId === ch.id && p.videoId === v.id && p.status !== 'error')) continue;
    return v.id;
  }
  return null;
};

const pumpPub = async () => {
  if (pubBusy || !pubQueue.length) return;
  const task = pubQueue.shift()!;
  const st = load();
  const ch = st.channels.find((c) => c.id === task.channelId);
  if (!ch) return pumpPub();
  const videoId = task.videoId ?? pickVideo(ch);
  if (!videoId) {
    log(`📭 ${ch.name}: žádné další hotové video (${LANG_DIR[ch.lang]}) k publikování.`);
    return pumpPub();
  }
  const s = getScript(videoId);
  if (!s) return pumpPub();
  pubBusy = `${ch.name} ← #${videoId}`;
  try {
    await publish(
      ch,
      {file: videoOutFile(s, ch.lang), title: s.title[ch.lang], description: s.description[ch.lang], hashtags: s.hashtags.map((h) => h.replace(/^#/, ''))},
      log,
    );
    update((x) => x.posts.push({channelId: ch.id, videoId, at: new Date().toISOString(), status: 'ok'}));
  } catch (e) {
    const message = (e as Error).message;
    log(`❌ ${ch.name} #${videoId}: ${message} (okno nechávám otevřené – dokonči ručně a dej „Označit jako publikované“)`);
    update((x) => x.posts.push({channelId: ch.id, videoId, at: new Date().toISOString(), status: 'error', message}));
  } finally {
    pubBusy = null;
  }
  setTimeout(pumpPub, 3000);
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Plánovač: v každém časovém slotu publikuje na každý zapnutý účet jedno video. */
const tick = () => {
  const st = load();
  if (!st.schedule.enabled) return;
  const now = new Date();
  const today = dayKey(now);
  let changed = false;
  for (const time of [...st.schedule.times].sort()) {
    const [h, m] = time.split(':').map(Number);
    const slot = new Date(now);
    slot.setHours(h, m, 0, 0);
    const late = now.getTime() - slot.getTime();
    // slot už nastal; zmeškaný (PC bylo vypnuté) dohoníme jen do 3 hodin
    if (late < 0 || late > 3 * 3600000) continue;
    const key = `${today} ${time}`;
    for (const ch of st.channels) {
      if (!ch.enabled) continue;
      if ((st.lastSlot[ch.id] ?? '') >= key) continue;
      st.lastSlot[ch.id] = key;
      changed = true;
      log(`⏰ Plán ${time}: ${ch.name}`);
      pubQueue.push({channelId: ch.id, manual: false});
    }
  }
  if (changed) {
    save(st);
    pumpPub();
  }
};
setInterval(tick, 30000);

const nextRun = () => {
  const st = load();
  if (!st.schedule.enabled || !st.schedule.times.length) return null;
  const now = new Date();
  for (let d = 0; d < 2; d++) {
    for (const time of [...st.schedule.times].sort()) {
      const [h, m] = time.split(':').map(Number);
      const t = new Date(now);
      t.setDate(t.getDate() + d);
      t.setHours(h, m, 0, 0);
      if (t > now) return t.toISOString();
    }
  }
  return null;
};

/* ============ přesun starých renderů ============ */
const migrate = () => {
  let moved = 0;
  for (const id of allScriptIds()) {
    const s = getScript(id);
    if (!s) continue;
    for (const lang of LANGS) {
      const old = oldRender(id, lang);
      const dest = videoOutFile(s, lang);
      if (!old || fs.existsSync(dest)) continue;
      fs.mkdirSync(path.dirname(dest), {recursive: true});
      fs.renameSync(old, dest);
      const txt = old.replace(/\.mp4$/, '.txt');
      fs.writeFileSync(path.join(path.dirname(dest), 'popis.txt'), fs.existsSync(txt) ? fs.readFileSync(txt) : captionText(s, lang));
      if (fs.existsSync(txt)) fs.rmSync(txt);
      moved++;
    }
  }
  for (const lang of LANGS) {
    const dir = path.join(P.videos, lang);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  }
  log(`📁 Přesunuto ${moved} starých videí do nové struktury.`);
  return moved;
};

/* ============ systémové věci ============ */
const openPath = (p: string) => {
  const cmd = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [p], {detached: true, stdio: 'ignore'}).unref();
};

const openAppWindow = () => {
  const url = `http://localhost:${PORT}`;
  const exe = findBrowser();
  if (exe) {
    spawn(exe, [`--app=${url}`, `--user-data-dir=${path.join(DATA, 'app-window')}`, '--window-size=1320,900', '--no-first-run'], {detached: true, stdio: 'ignore'}).unref();
  } else openPath(url);
};

const startupFile = () => path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Fyzika Studio.vbs');
const setAutostart = (on: boolean) => {
  if (process.platform !== 'win32') throw new Error('Automatické spuštění umím nastavit jen na Windows.');
  const f = startupFile();
  if (!on) return fs.rmSync(f, {force: true});
  const vbs = [
    'Set sh = CreateObject("WScript.Shell")',
    `sh.CurrentDirectory = "${ROOT}"`,
    `sh.Run "cmd /c ""${path.join(ROOT, 'Spustit Studio.bat')}"" --no-open", 7, False`,
  ].join('\r\n');
  fs.writeFileSync(f, vbs);
};

/* ============ HTTP ============ */
const CHUNK = 2 * 1024 * 1024;
const sendVideo = (req: http.IncomingMessage, res: http.ServerResponse, file: string) => {
  const size = fs.statSync(file).size;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  const start = range ? Number(range[1] || 0) : 0;
  const end = Math.min(size - 1, range?.[2] ? Number(range[2]) : start + CHUNK - 1);
  const len = Math.max(0, end - start + 1);
  const buf = Buffer.alloc(len);
  // soubor hned zavřeme (na Windows by jinak nešel přepsat novým renderem)
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buf, 0, len, start);
  } finally {
    fs.closeSync(fd);
  }
  res.writeHead(206, {'Content-Type': 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': len, 'Cache-Control': 'no-store'});
  res.end(buf);
};

const body = (req: http.IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve) => {
    let b = '';
    req.on('data', (d) => (b += d));
    req.on('end', () => {
      try {
        resolve(b ? JSON.parse(b) : {});
      } catch {
        resolve({});
      }
    });
  });

const json = (res: http.ServerResponse, data: unknown, code = 200) => {
  res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(data));
};

const langsOf = (x: unknown): Lang[] => (Array.isArray(x) ? x.filter((l): l is Lang => (LANGS as readonly string[]).includes(l)) : [...LANGS]);

const routes: Record<string, (req: http.IncomingMessage, res: http.ServerResponse, q: URLSearchParams) => Promise<void> | void> = {
  'GET /': (_q, res) => {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(fs.readFileSync(HTML_FILE));
  },
  'GET /api/overview': async (_req, res) => {
    const st = load();
    let render: unknown = null;
    try {
      render = JSON.parse(fs.readFileSync(path.join(OUT, 'stav.json'), 'utf8'));
    } catch {
      /* nic neběží */
    }
    const ideas = loadIdeas();
    const have = new Set(allScriptIds());
    json(res, {
      videos: videoList(),
      channels: st.channels,
      schedule: st.schedule,
      posts: st.posts.slice(-60).reverse(),
      jobs: jobs.slice(-12).reverse(),
      running: jobs.find((j) => j.status === 'running')?.label ?? null,
      render,
      pubBusy,
      pubQueue: pubQueue.length,
      nextRun: nextRun(),
      eleven: await elevenCredits(),
      ai: {spent: aiSpent(), budget: Number(process.env.AI_BUDGET_USD || 2.1), hasKey: !!process.env.ANTHROPIC_API_KEY},
      ideasLeft: ideas.filter((i) => !have.has(i.id)).length,
      browser: findBrowser(),
      autostart: process.platform === 'win32' ? fs.existsSync(startupFile()) : null,
      platform: process.platform,
    });
  },
  'GET /api/log': (_req, res) => json(res, LOG.slice(-200)),
  'GET /api/voices': (_req, res) => json(res, {catalog: VOICE_CATALOG, defaults: DEFAULT_VOICE}),
  'GET /api/voice-preview': async (_req, res, q) => {
    // ukázka hlasu z knihovny ElevenLabs (odkaz se může měnit, proto ho případně dohledáme)
    const id = q.get('id') || '';
    const v = findVoice(id);
    let url = v?.preview || '';
    if (!url && v) {
      try {
        // s klíčem jde hledat podle jména, bez něj jen přes veřejný žebříček (max 3 výsledky)
        const key = process.env.ELEVENLABS_API_KEY;
        const qs = key ? `page_size=10&search=${encodeURIComponent(v.name)}` : `page_size=3&${v.find ?? ''}`;
        const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${qs}`, {headers: key ? {'xi-api-key': key} : {}});
        const j = (await r.json()) as {voices?: {voice_id: string; preview_url: string}[]};
        url = j.voices?.find((x) => x.voice_id === id)?.preview_url || '';
      } catch {
        /* bez ukázky */
      }
    }
    if (!url) {
      res.writeHead(404);
      return res.end('Ukázka není k dispozici');
    }
    res.writeHead(302, {Location: url});
    res.end();
  },
  'POST /api/make': async (req, res) => {
    const b = await body(req);
    const ids = (b.ids as number[]) ?? [];
    const langs = langsOf(b.langs);
    const what = (b.what as string) || 'make';
    if (!ids.length) return json(res, {ok: false, error: 'Žádná videa'}, 400);
    const L = ['--langs', langs.join(',')];
    const steps: string[][] = [];
    const prov = b.provider ? ['--provider', String(b.provider)] : [];
    const force = b.force ? ['--force'] : [];
    if (what !== 'render') steps.push(['scripts/voice.ts', idsArg(ids), ...L, ...prov, ...(what === 'voice' ? force : [])]);
    if (what !== 'voice') steps.push(['scripts/render.ts', idsArg(ids), ...L, ...(what === 'render' ? force : [])]);
    const name = ids.length === 1 ? `#${ids[0]}` : `${ids.length} videí`;
    addJob(`${what === 'voice' ? 'Hlas' : what === 'render' ? 'Render' : 'Výroba'} ${name} (${langs.join(', ')})`, steps);
    json(res, {ok: true});
  },
  'POST /api/generate': async (req, res) => {
    const b = await body(req);
    const n = Math.max(1, Math.min(10, Number(b.count) || 1));
    addJob(`AI vymýšlí ${n} nových scénářů`, [['scripts/generate.ts', 'next', String(n)]]);
    json(res, {ok: true});
  },
  'POST /api/stop': (_req, res) => {
    stopRequested = true;
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'STOP'), String(Date.now()));
    for (const j of jobs) if (j.status === 'queued') j.status = 'stopped';
    if (child && !/render/.test(String(child.spawnargs.join(' ')))) child.kill();
    log('⏹️ Zastavuji…');
    json(res, {ok: true});
  },
  'POST /api/skip': async (req, res) => {
    const b = await body(req);
    update((s) => {
      for (const id of (b.ids as number[]) ?? [b.id as number]) s.skip[String(id)] = !!b.skip;
    });
    json(res, {ok: true});
  },
  'POST /api/channels': async (req, res) => {
    const b = await body(req);
    update((s) => {
      s.channels = ((b.channels as Channel[]) ?? s.channels).map((c, i) => ({
        id: c.id || `${c.platform}-${Date.now()}-${i}`,
        name: String(c.name || c.platform).slice(0, 40),
        platform: (['tiktok', 'instagram', 'youtube'] as Platform[]).includes(c.platform) ? c.platform : 'tiktok',
        lang: (LANGS as readonly string[]).includes(c.lang) ? c.lang : 'cs',
        enabled: !!c.enabled,
      }));
    });
    json(res, {ok: true});
  },
  'POST /api/schedule': async (req, res) => {
    const b = await body(req);
    update((s) => {
      if (typeof b.enabled === 'boolean') {
        s.schedule.enabled = b.enabled;
        if (b.enabled) {
          // sloty, které dnes už proběhly, nedoháníme – začneme od dalšího
          const now = new Date();
          const today = dayKey(now);
          const passed = s.schedule.times.filter((t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
          });
          const last = passed.sort().at(-1);
          for (const ch of s.channels) if (last) s.lastSlot[ch.id] = `${today} ${last}`;
        }
      }
      if (Array.isArray(b.times)) s.schedule.times = (b.times as string[]).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).map((t) => t.padStart(5, '0'));
    });
    log(`🗓️ Plán: ${load().schedule.enabled ? 'zapnut' : 'vypnut'} (${load().schedule.times.join(', ')})`);
    json(res, {ok: true});
  },
  'POST /api/login': async (req, res) => {
    const b = await body(req);
    const ch = load().channels.find((c) => c.id === b.channelId);
    if (!ch) return json(res, {ok: false, error: 'Účet nenalezen'}, 404);
    try {
      await openLogin(ch);
      log(`🔑 ${ch.name}: otevřeno okno pro přihlášení – přihlas se a okno zavři.`);
      json(res, {ok: true});
    } catch (e) {
      json(res, {ok: false, error: (e as Error).message}, 500);
    }
  },
  'POST /api/post-now': async (req, res) => {
    const b = await body(req);
    pubQueue.push({channelId: String(b.channelId), videoId: b.videoId ? Number(b.videoId) : undefined, manual: true});
    pumpPub();
    json(res, {ok: true});
  },
  'POST /api/mark': async (req, res) => {
    const b = await body(req);
    update((s) => {
      s.posts.push({channelId: String(b.channelId), videoId: Number(b.videoId), at: new Date().toISOString(), status: b.unmark ? 'error' : 'manual', message: b.unmark ? 'zrušeno ručně' : undefined});
      if (b.unmark) s.posts = s.posts.filter((p) => !(p.channelId === b.channelId && p.videoId === Number(b.videoId) && p.status !== 'error'));
    });
    json(res, {ok: true});
  },
  'POST /api/open': async (req, res) => {
    const b = await body(req);
    const s = b.id ? getScript(Number(b.id)) : null;
    const target = s ? path.dirname(videoOutFile(s, (b.lang as Lang) || 'cs')) : P.videos;
    fs.mkdirSync(target, {recursive: true});
    openPath(target);
    json(res, {ok: true});
  },
  'POST /api/migrate': (_req, res) => json(res, {ok: true, moved: migrate()}),
  'GET /api/caption': (_req, res, q) => {
    const s = getScript(Number(q.get('id')));
    const lang = (q.get('lang') as Lang) || 'cs';
    res.writeHead(s ? 200 : 404, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end(s ? captionText(s, lang) : '');
  },
  'GET /api/settings': (_req, res) => {
    const env = readEnv();
    json(
      res,
      Object.fromEntries(ENV_KEYS.map((k) => [k, SECRET.has(k) ? (env[k] ? `••••${env[k].slice(-4)}` : '') : (env[k] ?? '')])),
    );
  },
  'POST /api/settings': async (req, res) => {
    const b = await body(req);
    const patch: Record<string, string> = {};
    for (const k of ENV_KEYS) {
      const v = b[k];
      if (typeof v !== 'string') continue;
      if (SECRET.has(k) && v.startsWith('••••')) continue; // nezměněno
      patch[k] = v.trim();
    }
    writeEnv(patch);
    log('⚙️ Nastavení uloženo.');
    json(res, {ok: true});
  },
  'POST /api/autostart': async (req, res) => {
    const b = await body(req);
    try {
      setAutostart(!!b.on);
      json(res, {ok: true});
    } catch (e) {
      json(res, {ok: false, error: (e as Error).message}, 400);
    }
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://x');
  const key = `${req.method} ${decodeURIComponent(url.pathname)}`;
  try {
    const r = routes[key];
    if (r) return await r(req, res, url.searchParams);
    const m = decodeURIComponent(url.pathname).match(/^\/media\/(\d+)\/(cs|en|ro)\.mp4$/);
    if (m) {
      const s = getScript(Number(m[1]));
      const file = s ? videoOutFile(s, m[2] as Lang) : '';
      if (file && fs.existsSync(file)) return sendVideo(req, res, file);
    }
    res.writeHead(404);
    res.end('Nenalezeno');
  } catch (e) {
    json(res, {ok: false, error: String(e)}, 500);
  }
});

server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Studio už běží – otevírám okno (http://localhost:${PORT}).`);
    if (!process.argv.includes('--no-open')) openAppWindow();
    setTimeout(() => process.exit(0), 1500);
  } else throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  log(`🚀 Fyzika Studio běží: http://localhost:${PORT}  (${os.hostname()})`);
  log('   Nech toto okno otevřené – jinak se nebude renderovat ani publikovat.');
  if (!process.argv.includes('--no-open')) openAppWindow();
  tick();
});
