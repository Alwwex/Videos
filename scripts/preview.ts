// Vývojový nástroj: náhledové snímky (střed každé scény) → PNG
//   npx tsx scripts/preview.ts <outDir> <lang> <script.json> [další.json…]
import path from 'node:path';
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
const [OUT, lang, ...files] = process.argv.slice(2);
const main = async () => {
  const serveUrl = await bundle({entryPoint: path.join(process.cwd(), 'src', 'index.ts')});
  const browserExecutable = process.env.CHROME_PATH || null;
  for (const file of files) {
    const script = JSON.parse(fs.readFileSync(file, 'utf8'));
    const inputProps = {script, lang, timeline: null, nextTitle: 'Další díl'};
    const comp = await selectComposition({serveUrl, id: `Short-${lang}`, inputProps, browserExecutable});
    const n = script.scenes.length;
    // odhad: scény mají podobnou délku → snímek v 70 % každé scény
    for (let i = 0; i < n; i++) {
      const frame = Math.min(comp.durationInFrames - 1, Math.round(((i + 0.7) / n) * comp.durationInFrames));
      await renderStill({composition: comp, serveUrl, output: path.join(OUT, `${script.id}-${String(i).padStart(2, '0')}.png`), inputProps, frame, browserExecutable, scale: 0.4});
    }
    console.log('done', script.id, comp.durationInFrames);
  }
};
main();
