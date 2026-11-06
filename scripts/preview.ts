// Vývojový nástroj: náhledové snímky (konec každé scény) → PNG
//   npx tsx scripts/preview.ts <outDir> <lang> <script.json> [další.json…]
// Na počítači bez GPU: REMOTION_GL=swangle
import path from 'node:path';
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {estimateTimeline} from '../src/engine/localize';
const [OUT, lang, ...files] = process.argv.slice(2);
const main = async () => {
  const serveUrl = await bundle({entryPoint: path.join(process.cwd(), 'src', 'index.ts')});
  const browserExecutable = process.env.CHROME_PATH || null;
  const chromiumOptions = {gl: (process.env.REMOTION_GL || 'angle') as 'angle'};
  const at = Number(process.env.AT || 0.7);
  for (const file of files) {
    const script = JSON.parse(fs.readFileSync(file, 'utf8'));
    const tlFile = path.join('content', 'timelines', `${String(script.id).padStart(3, '0')}.${lang}.json`);
    const timeline = process.env.NO_TL ? null : fs.existsSync(tlFile) ? JSON.parse(fs.readFileSync(tlFile, 'utf8')) : null;
    const inputProps = {script, lang, timeline, nextTitle: 'Další díl'};
    const id = script.engine === 'hybrid' ? `Hybrid-${lang}` : script.engine === 'blueprint' ? `Short-${lang}` : `Fyzika-${lang}`;
    const comp = await selectComposition({serveUrl, id, inputProps, browserExecutable, chromiumOptions});
    const n = script.scenes.length;
    const frames = (process.env.FRAMES || '').split(',').filter(Boolean).map(Number);
    // hybridní videa: přesné začátky scén (stejný výpočet jako v kompozici)
    let ranges: [number, number][] | null = null;
    if (script.engine === 'hybrid') {
      ranges = [];
      let cur = 0;
      script.scenes.forEach((sc: never, i: number) => {
        const t = timeline?.scenes?.[i] ?? estimateTimeline(sc, lang as never);
        if (timeline?.continuous) {
          const from = Math.round((t.startSec ?? 0) * 30);
          const nx = timeline.scenes[i + 1];
          const end = nx ? Math.round(nx.startSec * 30) : Math.round(((t.startSec ?? 0) + t.durationSec) * 30);
          ranges!.push([from, end - from]);
        } else {
          const d = Math.max(39, Math.ceil((t.durationSec + 0.05) * 30));
          ranges!.push([cur, d]);
          cur += d;
        }
      });
      // závěr „sleduj“
      if (script.outro) {
        const last = ranges[ranges.length - 1];
        const o = timeline?.outro;
        const from = timeline?.continuous && o?.startSec !== undefined ? Math.round(o.startSec * 30) : last[0] + last[1];
        ranges.push([from, comp.durationInFrames - from]);
      }
    }
    const list = frames.length
      ? frames
      : ranges
        ? ranges.map(([f0, d]) => Math.min(comp.durationInFrames - 1, f0 + Math.round(d * at)))
        : Array.from({length: n}, (_, i) => Math.min(comp.durationInFrames - 1, Math.round(((i + at) / n) * comp.durationInFrames)));
    for (const [i, frame] of list.entries()) {
      await renderStill({composition: comp, serveUrl, output: path.join(OUT, `${script.id}-${String(i).padStart(2, '0')}.png`), inputProps, frame, browserExecutable, chromiumOptions, scale: Number(process.env.SCALE || 0.4)});
    }
    console.log('done', script.id, comp.durationInFrames);
  }
};
main();
