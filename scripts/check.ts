/**
 * Kontrola scénářů: npm run check   (projde content/scripts/*.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import {VideoScriptSchema, checkScript} from '../src/engine/schema';
import {ShortScriptSchema, checkShortScript} from '../src/v2/schema';
import {P} from './lib';

let bad = 0;
for (const f of fs.readdirSync(P.scripts).filter((x) => x.endsWith('.json')).sort()) {
  const raw = JSON.parse(fs.readFileSync(path.join(P.scripts, f), 'utf8'));
  const short = raw.engine === 'blueprint';
  const r = (short ? ShortScriptSchema : VideoScriptSchema).safeParse(raw);
  if (!r.success) {
    bad++;
    console.log(`❌ ${f}: ${r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ')}`);
    continue;
  }
  const errs = short ? checkShortScript(r.data as never) : checkScript(r.data as never);
  const words = (raw.scenes as {narration: {cs: string}}[]).reduce((n, s) => n + s.narration.cs.split(/\s+/).length, 0);
  if (errs.length) bad++;
  console.log(`${errs.length ? '⚠️ ' : '✅'} ${f} ${short ? 'v2' : 'v1'} ${raw.scenes.length} scén, ${words} slov (cs) ~${Math.round(words / 2.6)} s ${errs.join(' ')}`);
}
process.exit(bad ? 1 : 0);
