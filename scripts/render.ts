/**
 * Dávkový render: scénář (+ hlas, pokud existuje) → out/videos/NNN-nazev/<CZ|EN|RO>/video.mp4 + popis.txt
 *   npm run render:batch -- 1-10
 *   npm run render:batch -- 1 --langs cs --concurrency 4
 *   npm run render:batch -- 1-10 --no-music
 * Průběh: lišta v terminálu + soubor out/STAV.txt + panel (npm run panel)
 * Zastavení: npm run stop (nebo tlačítko v panelu) – render se korektně ukončí i s Chromem.
 */
import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {makeCancelSignal, renderMedia, selectComposition} from '@remotion/renderer';
import type {Lang, Timeline} from '../src/engine/schema';
import {P, Progress, ROOT, captionText, isShort, loadScript, loadTimeline, parseArgs, videoFolderName, videoOutFile, type AnyScript} from './lib';

/** Časová osa jen pokud existují všechny její MP3 (jinak by render spadl). */
const usableTimeline = (id: number, lang: Lang, sceneCount: number): Timeline | null => {
  const tl = loadTimeline(id, lang) as (Timeline & {partial?: boolean}) | null;
  if (!tl || tl.partial || tl.scenes.length !== sceneCount) return null;
  const ok = tl.scenes.every((s) => !s.audioSrc || fs.existsSync(path.join(ROOT, 'public', s.audioSrc)));
  return ok ? tl : null;
};
// bez hlasu se video nerenderuje (němé video by se mohlo omylem publikovat); --allow-silent to povolí
const allowSilent = process.argv.includes('--allow-silent');

const LOCK = path.join(process.cwd(), 'out', 'render.lock');
const STOP = path.join(process.cwd(), 'out', 'STOP');

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Jen jeden render najednou – jinak si rendery přepisují soubory a perou se o CPU. */
const acquireLock = () => {
  if (fs.existsSync(LOCK)) {
    const pid = Number(fs.readFileSync(LOCK, 'utf8'));
    if (pid && isAlive(pid)) {
      console.error(`❌ Už běží jiný render (PID ${pid}). Zastav ho příkazem  npm run stop  nebo v panelu.`);
      process.exit(1);
    }
  }
  fs.mkdirSync(path.dirname(LOCK), {recursive: true});
  fs.writeFileSync(LOCK, String(process.pid));
  fs.rmSync(STOP, {force: true});
  const release = () => {
    try {
      if (fs.existsSync(LOCK) && fs.readFileSync(LOCK, 'utf8') === String(process.pid)) fs.rmSync(LOCK);
    } catch {
      /* nic */
    }
  };
  process.on('exit', release);
};

const main = async () => {
  const {ids, langs, force, concurrency, noMusic} = parseArgs();
  acquireLock();

  // nejdřív seznam úloh, ať lišta zná celkový počet
  const jobs: {id: number; lang: Lang; script: AnyScript; name: string; out: string}[] = [];
  for (const id of ids) {
    const script = loadScript(id);
    if (!script) {
      console.warn(`⏭️  #${id} nemá scénář`);
      continue;
    }
    for (const lang of langs) {
      const name = videoFolderName(script);
      const out = videoOutFile(script, lang);
      if (fs.existsSync(out) && !force) continue;
      if (!allowSilent && !usableTimeline(id, lang, script.scenes.length)) {
        console.warn(`⏭️  ${videoFolderName(script)}/${lang}: chybí hlas – nejdřív ho namluv (render přeskočen)`);
        continue;
      }
      jobs.push({id, lang, script, name, out});
    }
  }
  if (!jobs.length) return console.log('Nic k renderování (hotová videa se přeskakují, pro přepsání použij --force).');

  console.log(`📦 Bundluji projekt… (${jobs.length} videí ve frontě)`);
  const serveUrl = await bundle({entryPoint: path.join(process.cwd(), 'src', 'index.ts')});
  const chromiumOptions = {gl: 'angle' as const};
  const browserExecutable = process.env.CHROME_PATH || null;
  const musicDir = path.join(process.cwd(), 'public', 'music');
  // vlastní skladby v public/music se střídají podle čísla videa; jinak smyčka podle tématu
  const userTracks = fs.existsSync(musicDir)
    ? fs.readdirSync(musicDir).filter((f) => /\.(mp3|wav|m4a)$/i.test(f) && !/^(default-loop|loop-[a-d])\.wav$/.test(f))
    : [];

  // render jde nejdřív do dočasné složky; hotové video se pak přesune na místo
  // (na Windows nejde přepsat soubor, který má otevřený přehrávač)
  const tmpDir = path.join(P.videos, '.tmp');
  fs.mkdirSync(tmpDir, {recursive: true});
  const pending: {tmp: string; out: string; label: string}[] = [];
  const tryMove = (tmp: string, out: string) => {
    try {
      fs.mkdirSync(path.dirname(out), {recursive: true});
      fs.rmSync(out, {force: true});
      fs.renameSync(tmp, out);
      return true;
    } catch {
      return false;
    }
  };

  const bar = new Progress('🎬 Render', jobs.length);
  let stopped = false;
  for (const {id, lang, script, name, out} of jobs) {
    if (fs.existsSync(STOP)) {
      stopped = true;
      break;
    }
    const {cancelSignal, cancel} = makeCancelSignal();
    const label = `${name}/${lang}`;
    const timeline = usableTimeline(id, lang, script.scenes.length);
    const music = noMusic ? null : userTracks.length ? `music/${userTracks[id % userTracks.length]}` : undefined;
    const next = loadScript(id + 1);
    const inputProps: Record<string, unknown> = {script, lang, timeline, music, nextTitle: next ? next.title[lang] : null};
    const compId = isShort(script) ? `Short-${lang}` : `Fyzika-${lang}`;
    const t = Date.now();
    const tmp = path.join(tmpDir, `${lang}-${name}.mp4`);
    try {
      const composition = await selectComposition({serveUrl, id: compId, inputProps, chromiumOptions, browserExecutable});
      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        crf: 21,
        outputLocation: tmp,
        inputProps,
        chromiumOptions,
        browserExecutable,
        imageFormat: 'jpeg',
        jpegQuality: 90,
        concurrency: concurrency || null,
        cancelSignal,
        onProgress: ({progress}) => {
          bar.update(label, progress);
          if (fs.existsSync(STOP)) cancel();
        },
      });
      fs.mkdirSync(path.dirname(out), {recursive: true});
      fs.writeFileSync(path.join(path.dirname(out), 'popis.txt'), captionText(script, lang));
      const moved = tryMove(tmp, out);
      if (!moved) pending.push({tmp, out, label});
      bar.ok(
        `${label}.mp4 (${(composition.durationInFrames / composition.fps).toFixed(0)} s, ${((Date.now() - t) / 60000).toFixed(1)} min)${timeline ? '' : ' 🔇 bez hlasu'}${moved ? '' : ' ⏳ čeká, až zavřeš přehrávač'}`,
      );
    } catch (e) {
      if (fs.existsSync(STOP)) {
        stopped = true;
        fs.rmSync(tmp, {force: true});
        break;
      }
      bar.fail(`${label}: ${(e as Error).message}`);
    }
  }
  if (stopped) {
    bar.stopped();
    fs.rmSync(STOP, {force: true});
    console.log('\n⏹️  Render zastaven. Hotová videa zůstala, zbytek dorenderuješ: npm run render:batch -- <čísla>');
  }

  // videa, která nešla přesunout (otevřený soubor): zkoušíme ještě 2 minuty
  for (let attempt = 0; pending.length && attempt < 40; attempt++) {
    for (const p of [...pending]) if (tryMove(p.tmp, p.out)) pending.splice(pending.indexOf(p), 1);
    if (pending.length) await new Promise((r) => setTimeout(r, 3000));
  }
  for (const p of pending) console.log(`\n⚠️  ${p.label}: hotové video leží v ${path.relative(process.cwd(), p.tmp)} – zavři přehrávač a přesuň ho ručně, nebo pusť render znovu.`);
};

main();
