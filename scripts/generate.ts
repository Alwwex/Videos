/**
 * AI generátor scénářů (Claude): nápad z napady/napady.json → content/scripts/NNN.json (CZ/EN/RO).
 *   npm run generate -- 45-50
 *   npm run generate -- next 3        (3 další nápady, které ještě nemají scénář)
 *   npm run generate -- 45 --force    (přepíše existující)
 * Útrata se zapisuje do out/ai-usage.json, rozpočet hlídá AI_BUDGET_USD (výchozí 2.1).
 */
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import {CURVES, ICONS, ShortScriptSchema, checkShortScript, type ShortScript} from '../src/v2/schema';
import {ROOT, allScriptIds, loadIdeas, parseArgs, pool, scriptPath, writeJson, type Idea} from './lib';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT = (process.env.CLAUDE_EFFORT || 'medium') as 'low' | 'medium' | 'high';
// ceny Claude Opus 5.5 v USD za milion tokenů (vstup, výstup, čtení z cache, zápis do cache 1 h)
const PRICE = {in: 4, out: 20, cacheRead: 0.2, cacheWrite: 8};
const BUDGET = Number(process.env.AI_BUDGET_USD || 2.1);
const USAGE = path.join(ROOT, 'out', 'ai-usage.json');

type UsageRow = {id: number; usd: number; at: string; model: string};
export const aiSpent = (): number => {
  try {
    return (JSON.parse(fs.readFileSync(USAGE, 'utf8')) as UsageRow[]).reduce((n, r) => n + r.usd, 0);
  } catch {
    return 0;
  }
};
const logUsage = (row: UsageRow) => {
  let all: UsageRow[] = [];
  try {
    all = JSON.parse(fs.readFileSync(USAGE, 'utf8'));
  } catch {
    /* první záznam */
  }
  all.push(row);
  fs.mkdirSync(path.dirname(USAGE), {recursive: true});
  fs.writeFileSync(USAGE, JSON.stringify(all, null, 1));
};

const example = fs.readFileSync(scriptPath(17), 'utf8');

const SYSTEM = `You write scripts for "Physics around you" (Czech: "Fyzika kolem tebe"), a series of SHORT (25-30 second) vertical explainer videos for TikTok, Instagram Reels and YouTube Shorts. Each video explains one everyday physics phenomenon to curious teens and adults. Every video is published in Czech (cs), English (en) and Romanian (ro).

The look is a clean technical "engineer's notebook": a big two-line headline at the top, one animated diagram in the middle, word-by-word subtitles at the bottom. You compose each scene from a fixed set of diagram widgets ("visual").

## Story rules
- Exactly 8 content scenes plus a final scene whose visual is {"type":"outro"} (9 scenes total).
- Each narration is ONE short spoken sentence of 5-11 words (about 2-3.5 s). Total about 65-80 words per language.
- Scene 1 is a strong hook: a surprising claim or a question (a "quiz" visual works great). Then a clear chain of cause and effect, one idea per scene, with concrete numbers where they help. The outro narration asks to follow (vary the wording).
- The physics must be correct. Bust myths instead of repeating them. Simplify, but never say something false.
- Write each language natively (casual "ty" in Czech, "tu" in Romanian) with correct diacritics. Mark 1-2 key words per narration with *asterisks*. No emoji in narration; no symbols like "%" or "°C" in narration (write them as words). Digits are fine.
- headline: UPPERCASE, 2-5 words, two lines split by "|" (second line is colored). Keep each line under ~16 characters.
- tag: short technical English label in UPPERCASE (e.g. "RAYLEIGH SCATTERING", "F = m·a"), or null.
- accent: yellow | teal | red | blue — vary it between scenes.

## Visual widgets
- icon: one big line-art pictogram (or two with relation arrow/vs/plus), effect pulse/shake/spin/float/none, optional caption.
- formula: KaTeX formula; wrap the key term in \\hl{...}. Optional caption.
- counter: big animated number from → to with unit and caption. gauge: speedometer dial (from, to, max).
- graph: axes + animated curve (${CURVES.join(', ')}), optional dashed curve2, axis labels, markLabel.
- bars: 2-4 horizontal bars with values (highlight the important one). compare: two cards with icon/label/value, optional winner.
- steps: 2-4 numbered steps with the active one highlighted (reuse the same items in consecutive scenes with a growing "active").
- forces: free-body diagram: body icon + 1-4 arrows (dir, size 1-3, label, color), motion.
- wave: single | compare (long vs short wave) | cancel (noise + anti-noise = silence) | doppler (moving siren) | blocked (WiFi through a wall).
- particles: solid | liquid | gas | hotcold (slow cold vs fast hot molecules) | rise (convection) | pressure (molecules hitting a wall) | evaporate.
- orbit: orbit (body circling center with velocity + gravity arrows) | tilt (Earth's tilted axis around the Sun) | tides (water bulge toward the Moon) | spin (rotating Earth).
- rays: scatter (blue sky) | sunset | prism (rainbow) | refract | mirror | twinkle.
- field: magnet | coil (wireless charging) | charge (static spark to a door handle) | spark (lightning).
- fall: two objects falling side by side, with or without air.
- quiz: question + 2-4 options + answer index (the answer is revealed at the end of the scene).
- outro: follow card (last scene only).
Icons available: ${ICONS.join(', ')}.

## Exact JSON format (TypeScript notation; T = {cs: string, en: string, ro: string})
type Script = {engine: "blueprint", id: number, title: T, description: T, hashtags: string[], scenes: Scene[]}
type Scene = {narration: T, headline: T, tag: string | null, accent: "yellow"|"teal"|"red"|"blue", visual: Visual}
type Icon = one of the icons listed above
type Visual =
 | {type:"icon", icon: Icon, icon2: Icon|null, relation: "arrow"|"vs"|"plus"|"none", effect: "pulse"|"shake"|"spin"|"float"|"none", caption: T|null}
 | {type:"formula", tex: string, caption: T|null}
 | {type:"counter", from: number, to: number, decimals: number, unit: T, caption: T}
 | {type:"gauge", from: number, to: number, max: number, unit: T, caption: T}
 | {type:"graph", curve: Curve, curve2: Curve|null, x: T, y: T, markLabel: T|null}   // Curve = ${CURVES.map((c) => `"${c}"`).join('|')}
 | {type:"bars", items: {label: T, value: number, highlight: boolean}[], unit: T}
 | {type:"compare", left: {icon: Icon, label: T, value: T|null}, right: {icon: Icon, label: T, value: T|null}, winner: "left"|"right"|"none"}
 | {type:"steps", items: T[], active: number}
 | {type:"forces", body: Icon, arrows: {dir: "up"|"down"|"left"|"right"|"upLeft"|"upRight"|"downLeft"|"downRight", size: number, label: T, color: "yellow"|"teal"|"red"|"blue"}[], motion: "none"|"up"|"down"|"left"|"right"|"shake"}
 | {type:"wave", mode: "single"|"compare"|"cancel"|"doppler"|"blocked", label: T|null}
 | {type:"particles", mode: "solid"|"liquid"|"gas"|"hotcold"|"rise"|"pressure"|"evaporate", label: T|null}
 | {type:"orbit", mode: "orbit"|"tilt"|"tides"|"spin", center: Icon, body: Icon, label: T|null}
 | {type:"rays", mode: "scatter"|"prism"|"refract"|"mirror"|"twinkle"|"sunset", label: T|null}
 | {type:"field", mode: "magnet"|"coil"|"charge"|"spark", label: T|null}
 | {type:"fall", left: Icon, right: Icon, air: boolean, label: T|null}
 | {type:"quiz", question: T, options: T[], answer: number}
 | {type:"outro"}
Every field is required (use null where allowed). Reply with ONLY the JSON object: no prose, no markdown code fences.

## Example of a complete, correct script
${example}`;

/** Vytáhne JSON z odpovědi a zkontroluje ho schématem; vrátí skript nebo seznam chyb. */
const parseReply = (text: string): {script: ShortScript | null; errors: string[]} => {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return {script: null, errors: ['The answer did not contain a JSON object.']};
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(a, b + 1));
  } catch (e) {
    return {script: null, errors: [`Invalid JSON: ${(e as Error).message}`]};
  }
  const r = ShortScriptSchema.safeParse(raw);
  if (!r.success) return {script: null, errors: r.error.issues.slice(0, 12).map((i) => `${i.path.join('.')}: ${i.message}`)};
  return {script: r.data, errors: []};
};

const client = new Anthropic();

const generateOne = async (idea: Idea, force: boolean) => {
  const file = scriptPath(idea.id);
  if (fs.existsSync(file) && !force) {
    console.log(`⏭️  #${idea.id} už existuje (použij --force)`);
    return;
  }
  if (aiSpent() >= BUDGET) {
    console.error(`💸 Rozpočet AI_BUDGET_USD=${BUDGET} $ je vyčerpaný (utraceno ${aiSpent().toFixed(2)} $). Navyš ho v nastavení.`);
    return;
  }
  let feedback = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now();
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: {type: 'adaptive'},
      output_config: {effort: EFFORT},
      system: [{type: 'text', text: SYSTEM, cache_control: {type: 'ephemeral', ttl: '1h'}}],
      messages: [
        {
          role: 'user',
          content: `Write the script for idea #${idea.id} (category: ${idea.kategorie}). Topic (in Czech): "${idea.tema}". Use id ${idea.id} and engine "blueprint".${feedback}`,
        },
      ],
    });
    const msg = await stream.finalMessage();
    const u = msg.usage;
    const usd =
      ((u.input_tokens ?? 0) * PRICE.in + (u.output_tokens ?? 0) * PRICE.out + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) / 1e6;
    logUsage({id: idea.id, usd, at: new Date().toISOString(), model: MODEL});
    const secs = ((Date.now() - t0) / 1000).toFixed(0);

    if (msg.stop_reason === 'refusal') {
      console.warn(`⚠️  #${idea.id} AI odmítla téma, přeskakuji.`);
      return;
    }
    if (msg.stop_reason === 'max_tokens') {
      feedback = '\n\nYour previous answer was too long and got cut off. Be more concise.';
      continue;
    }
    const text = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
    const parsed = parseReply(text);
    const script = parsed.script;
    if (!script) {
      console.warn(`🔁 #${idea.id} pokus ${attempt}: odpověď neodpovídá formátu – opravuji`);
      feedback = `\n\nYour previous answer did not match the JSON format:\n- ${parsed.errors.join('\n- ')}\nReply with the complete corrected JSON only.`;
      continue;
    }
    script.id = idea.id;
    script.engine = 'blueprint';
    const errors = checkShortScript(script);
    if (errors.length) {
      console.warn(`🔁 #${idea.id} pokus ${attempt}: ${errors.length} chyb – opravuji`);
      feedback = `\n\nA previous attempt had these problems; avoid them:\n- ${errors.join('\n- ')}`;
      continue;
    }
    writeJson(file, script);
    console.log(`✅ #${idea.id} "${script.title.cs}" – ${script.scenes.length} scén, ${secs}s, ${usd.toFixed(3)} $ (celkem ${aiSpent().toFixed(2)} $ z ${BUDGET} $)`);
    return;
  }
  console.error(`❌ #${idea.id} se nepodařilo vygenerovat ani na 3 pokusy.`);
};

const main = async () => {
  const argv = process.argv.slice(2);
  let ideas: Idea[];
  let force = false;
  let concurrency = 1;
  const done = new Set(allScriptIds());
  if (argv[0] === 'next') {
    const n = Number(argv[1] || 1);
    ideas = loadIdeas().filter((i) => !done.has(i.id)).slice(0, n);
    force = argv.includes('--force');
  } else {
    const a = parseArgs();
    force = a.force;
    concurrency = a.concurrency || 1;
    ideas = loadIdeas().filter((i) => a.ids.includes(i.id));
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error('❌ Chybí ANTHROPIC_API_KEY. Doplň ho ve Studiu → Nastavení (nebo v souboru .env).');
    process.exit(1);
  }
  if (!ideas.length) return console.log('Žádné nápady k vygenerování (doplň je do napady/napady.json).');
  await pool(ideas, concurrency, async (idea) => {
    try {
      await generateOne(idea, force);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) {
        console.error('❌ Neplatný ANTHROPIC_API_KEY.');
        process.exit(1);
      } else if (e instanceof Anthropic.RateLimitError) console.error(`⏳ #${idea.id} rate limit – zkus to znovu později.`);
      else if (e instanceof Anthropic.APIError && /credit balance|billing/i.test(e.message)) {
        // došel kredit na účtu Anthropic – hotové scénáře už jsou uložené, zbytek nemá cenu zkoušet
        console.error('💸 Na Anthropic účtu došel kredit. Hotové scénáře jsou uložené; po dobití pusť generování znovu.');
        process.exit(1);
      } else if (e instanceof Anthropic.APIError) console.error(`❌ #${idea.id} API ${e.status}: ${e.message}`);
      else if (e instanceof Anthropic.AnthropicError) console.error(`❌ #${idea.id} ${e.message}`);
      else throw e;
    }
  });
};

main();
