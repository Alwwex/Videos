/**
 * AI generátor scénářů (Claude): nápad z napady/napady.json → content/scripts/NNN.json (CZ/EN/RO),
 * ve stejném hybridním stylu jako videa 15–44 (3D svět + karty + ručně kreslené popisky).
 *   npm run generate -- 45-50
 *   npm run generate -- next 3        (3 další nápady, které ještě nemají scénář)
 *   npm run generate -- 45 --force    (přepíše existující)
 * Útrata se zapisuje do out/ai-usage.json, rozpočet hlídá AI_BUDGET_USD (výchozí 2.1).
 */
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import {CURVES, ICONS} from '../src/v2/schema';
import {PROP_TYPES} from '../src/engine/schema';
import {HybridScriptSchema, checkHybrid, type HybridScript} from '../src/v3/schema';
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

const example = fs.readFileSync(scriptPath(19), 'utf8');

const SYSTEM = `You write scripts for "Physics around you" (Czech: "Fyzika kolem tebe"), a series of SHORT (about 20-25 second) vertical videos for TikTok, Instagram Reels and YouTube Shorts. Each video explains one surprising everyday physics fact. Every video is published in Czech (cs), English (en) and Romanian (ro).

The look: a colorful low-poly 3D world (built from a fixed library of props) with a moving camera, hand-drawn marker arrows with handwritten labels ("notes"), an optional info card taped at the top (a number, gauge, formula, graph, bars, comparison, steps or quiz), and big centered subtitles. Scene 1 also shows a huge "hook" text.

## What makes these videos work (follow this closely)
- The first 2 seconds decide everything. Scene 1 states the most surprising claim of the whole video, as a fact or a direct question to the viewer ("Your head is older than your feet."). Never start with "Did you know", "In this video", "Have you ever wondered".
- Pick an angle that makes people stop: a myth bust, an absurd but true number, a "what if", something about their body, phone or home. Avoid textbook phrasing.
- Then one fast chain of cause and effect, one idea per scene, with one concrete, correct number where it helps. The last scene ends with a punchline, a twist or a practical takeaway (no "follow" there).
- outro: one separate short line said after the last scene that asks people to follow (5-10 words). Casual, different in every video, ideally tied to the topic ("Try folding one, then hit *follow*.", "Send this to someone who loves blue, and *follow*."). Czech: "Dej *sledovat*…" / "*Sleduj* nás…", Romanian: "*Urmărește-ne*…". Mark the follow word with *asterisks*.
- Sound like a real person talking to a friend: short, casual, a bit of humor, no filler, no marketing words, no "fascinating", "incredible", "let's dive in". Czech uses "ty", Romanian uses "tu". Write each language natively, not as a translation, with correct diacritics.
- The physics must be correct. Simplify, but never say something false.

## Format rules
- 7 scenes. Each narration is ONE sentence of 5-12 words (two very short sentences are fine). Total about 50-65 words per language. Mark 1-2 key words per narration with *asterisks* (they get highlighted). No emoji, no "%" or "°C" symbols in narration (write them as words); digits are fine.
- hook: on-screen text for scene 1, UPPERCASE, max 7 words, the same claim as the first narration. Symbols like °C are fine here.
- notes: 0-2 per scene, 1-3 casual handwritten words pointing at a prop ("you!", "K-40", "still falling"). Use them in most scenes.
- card: in 2-4 scenes, never in scene 1. Numbers in cards must match the narration.
- shake: true only for impacts or explosions.

## 3D world
- Meters. Ground or floor is y=0, +x right, +y up, +z toward the camera. environment: "outdoor" (grass island), "indoor" (floor + back wall), "space" (stars, no ground – props float).
- A "table" has its top at y=0.85; objects standing on it use y=0.85.
- Props (approximate height at scale 1, center at y+ANCHOR): ${PROP_TYPES.join(', ')}.
  Notes: person ~1.9 m; cat ~0.6 m (anim "slide" = falls and rights itself, "bob" = upside down, "shake" = twisting); elevator = cabin 1.7 m with long rails (put a person inside, scale ~0.82); earthCut = transparent Earth with core and a tunnel (radius 2); planet = plain colored planet (use color for Venus/Jupiter); powerLine = two poles 6 m apart with 3 wires at y≈3.92 (birds sit at y≈3.94); carGlass = car with see-through cabin; balloon = helium balloon on a string; waterPool = 4×3 m slab (also usable as ice rink or Moon ground with a color); iceCube with color #ffffff = sugar cube; weighScale = bathroom scale; arrow/arrowUp/arrowDown show directions.
- anim: none | spin | bob | pulse | shake | slide (moves from position to slideTo; otherwise slideTo is null) | vanish (disappears mid-scene) | shock (person only: arms up, open mouth – use it in 1-2 surprise moments per video, e.g. scene 1). glow makes things shine (bulbs, hot things, alarms).
- flows: particles from one prop to another (photons, electrons, heat, cold, water, air, sound, light, microwaves). waves: rings from a prop (sound, radio, heat, light, microwaves).
- camera: focus = prop id; distance: small objects 2-3, people 3.5-5, houses 8-11, space 6-14; angle front | frontLeft | frontRight | side | top | low; move dollyIn | dollyOut | orbitLeft | orbitRight | rise. Vary them. The camera frames all props automatically.
- 1-5 props per scene; keep the same objects at the same positions in consecutive scenes; ids only need to be unique within a scene.

## Card widgets (field "card", same as these JSON shapes)
 | {type:"counter", from, to, decimals, unit: T, caption: T}
 | {type:"gauge", from, to, max, unit: T, caption: T}
 | {type:"formula", tex: string (KaTeX, wrap the key term in \\\\hl{...}), caption: T|null}
 | {type:"graph", curve: ${CURVES.map((c) => `"${c}"`).join('|')}, curve2: null, x: T, y: T, markLabel: T|null}
 | {type:"bars", items: {label: T, value: number, highlight: boolean}[] (2-4), unit: T}
 | {type:"compare", left: {icon, label: T, value: T|null}, right: {...}, winner: "left"|"right"|"none"}
 | {type:"steps", items: T[] (2-4), active: number}
 | {type:"quiz", question: T, options: T[] (2-4), answer: number}
 | {type:"wave", mode: "single"|"compare"|"cancel"|"doppler"|"blocked", label: T|null}
 | {type:"particles", mode: "solid"|"liquid"|"gas"|"hotcold"|"rise"|"pressure"|"evaporate", label: T|null}
 | {type:"orbit", mode: "orbit"|"tilt"|"tides"|"spin", center: Icon, body: Icon, label: T|null}
 | {type:"rays", mode: "scatter"|"prism"|"refract"|"mirror"|"twinkle"|"sunset", label: T|null}
 | {type:"field", mode: "magnet"|"coil"|"charge"|"spark", label: T|null}
 | {type:"forces", body: Icon, arrows: {dir, size, label: T, color}[], motion}
Card icons: ${ICONS.join(', ')}.

## Exact JSON format (TypeScript notation; T = {cs: string, en: string, ro: string})
type Script = {engine: "hybrid", id: number, title: T, description: T, hashtags: string[] (5-7, no #), hook: T, outro: T, scenes: Scene[]}
type Scene = {narration: T, environment, props: Prop[], flows: {from, to, kind}[], waves: {from, kind}[], camera: {focus, distance, angle, move}, notes: {prop, text: T}[], card: Card | null, shake: boolean}
type Prop = {id, type, position: [x,y,z], scale, rotationY (degrees), color: string|null, anim, slideTo: [x,y,z]|null, glow: boolean}
Every field is required (use null or [] where allowed). Reply with ONLY the JSON object: no prose, no markdown code fences.

## Example of a complete, correct script
${example}`;

/** Vytáhne JSON z odpovědi a zkontroluje ho schématem; vrátí skript nebo seznam chyb. */
const parseReply = (text: string): {script: HybridScript | null; errors: string[]} => {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return {script: null, errors: ['The answer did not contain a JSON object.']};
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(a, b + 1));
  } catch (e) {
    return {script: null, errors: [`Invalid JSON: ${(e as Error).message}`]};
  }
  const r = HybridScriptSchema.safeParse(raw);
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
          content: `Write the script for idea #${idea.id} (category: ${idea.kategorie}). Topic (in Czech): "${idea.tema}". Use id ${idea.id} and engine "hybrid".${feedback}`,
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
    script.engine = 'hybrid';
    const errors = checkHybrid(script);
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
