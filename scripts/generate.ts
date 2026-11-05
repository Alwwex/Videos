/**
 * AI generátor scénářů: nápad z napady/napady.json → content/scripts/NNN.json (CZ/EN/RO).
 *   npm run generate -- 1-10
 *   npm run generate -- all --concurrency 3
 *   npm run generate -- 5 --force      (přepíše existující)
 */
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import {betaZodOutputFormat} from '@anthropic-ai/sdk/helpers/beta/zod';
import {PROP_TYPES, VideoScriptSchema, checkScript, type VideoScript} from '../src/engine/schema';
import {ANCHOR_Y} from '../src/engine/anim';
import {loadIdeas, parseArgs, pool, scriptPath, writeJson, type Idea} from './lib';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT = (process.env.CLAUDE_EFFORT || 'medium') as 'low' | 'medium' | 'high';

const example = fs.readFileSync(scriptPath(1), 'utf8');

const SYSTEM = `You write scripts for "Physics around you" (Czech: "Fyzika kolem tebe"), a series of ~60-second vertical (9:16) explainer videos for TikTok, Instagram Reels and YouTube Shorts. Each video explains one everyday physics phenomenon to curious teens and adults. Every video is published in Czech (cs), English (en) and Romanian (ro).

Your output is a JSON script rendered automatically by a 3D engine (low-poly world, warm light, slow camera moves). You cannot invent 3D models; you compose each scene from a fixed library of props and effects.

## Story
- 14-16 scenes. Each scene's narration is ONE short spoken sentence of 5-11 words (about 2.5-4.5 s of speech). Total per language: about 140-160 words, so the video lasts about 60 s.
- Scene 1 is a hook: a surprising question or claim that makes people keep watching. The last scene is a short call to action to follow for more (vary the wording between videos).
- Build a clear chain of cause and effect, one idea per scene. Use concrete numbers when they help, and show them with the counter.
- The physics must be correct. Do not repeat popular myths (for example "microwaves heat from the inside"). Simplify, but never say something false.
- Write each language natively and naturally (casual "ty" form in Czech, "tu" in Romanian), not as a word-for-word translation. Use correct diacritics (ř, ů, ș, ț, ă, î, â).
- In every narration mark 1-2 key words with *asterisks* (they are shown in yellow). Do not put emoji, abbreviations or symbols such as "%" or "°C" in the narration; write them out as words. Digits are fine.

## World and coordinates
- Meters. Ground or floor is y=0. +x is right, +y is up, +z is toward the default camera.
- environment: "outdoor" (grass island), "indoor" (wooden floor and a back wall at z=-6), "space" (stars, no ground; let props float).
- The frame is tall and narrow. At camera distance d, the visible width is only about ±0.23·d around the focus, and the height about ±0.4·d. Keep every prop you want visible inside that box, and use 1-4 props per scene.
- A "table" prop has its top at y=0.85; put objects that stand on it at y=0.85.
- Prop sizes at scale 1 (approximate height; the camera and labels aim at the prop's center):
${PROP_TYPES.map((t) => `  - ${t} (center at y+${ANCHOR_Y[t]})`).join('\n')}
  Notes: sun, moon, earth, cloud, plane, satellite, atom, lens, snowflake, lightning and the arrows are centered on their position, so give them a y above the ground. Use "atom" for any atom or molecule. Arrows show forces and directions ("arrow" points to +x; rotate it with rotationY). "cup" can also stand in for a plate or a bowl with a color override. "waterPool" is a 4×3 m slab of water.
- anim: none | spin | bob | pulse | shake | slide (slide moves the prop from position to slideTo during the scene; otherwise slideTo is null). glow makes the prop shine (bulbs light up, microwaves and stoves turn on, and so on).
- flows: a stream of particles from one prop to another (photons, electrons, heat, cold, water, air, sound, light, microwaves).
- waves: rings expanding from a prop (sound, radio, heat, light, microwaves).
- camera: focus = a prop id. Distance: small objects 2.5-4, people and appliances 4-6, a house 8-12, big outdoor or space scenes 10-18. Vary angle and move from scene to scene. Every scene's camera moves slowly; there is no static option.
- labels: at most 2 per scene. Each label is a short tag (max 18 characters) with one emoji, pointing at a prop. Don't add one to every scene.
- counter: a big animated number (from → to) with a unit and a short caption. Use it in about 3-5 scenes, and only with real, meaningful values that match the narration. Otherwise null.
- Props are defined separately in each scene, and ids only need to be unique within the scene. Keep the same objects at the same positions across consecutive scenes so the world feels continuous.

## Example of a complete, correct script (idea #1)
${example}`;

const client = new Anthropic();

const generateOne = async (idea: Idea, force: boolean) => {
  const file = scriptPath(idea.id);
  if (fs.existsSync(file) && !force) {
    console.log(`⏭️  #${idea.id} už existuje (použij --force)`);
    return;
  }
  let feedback = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now();
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: {type: 'adaptive'},
      output_config: {effort: EFFORT, format: betaZodOutputFormat(VideoScriptSchema)},
      system: [{type: 'text', text: SYSTEM, cache_control: {type: 'ephemeral', ttl: '1h'}}],
      messages: [
        {
          role: 'user',
          content: `Write the script for idea #${idea.id} (category: ${idea.kategorie}). Topic (in Czech): "${idea.tema}". Use id ${idea.id}.${feedback}`,
        },
      ],
    });
    const msg = await stream.finalMessage();
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    const u = msg.usage;
    const usage = `in ${u.input_tokens} (+cache ${u.cache_read_input_tokens ?? 0}), out ${u.output_tokens}`;

    if (msg.stop_reason === 'refusal') {
      console.warn(`⚠️  #${idea.id} AI odmítla téma (${msg.stop_details?.category ?? '?'}), přeskakuji.`);
      return;
    }
    if (msg.stop_reason === 'max_tokens') {
      feedback = '\n\nYour previous answer was too long and got cut off. Be more concise.';
      continue;
    }
    const script = msg.parsed_output as VideoScript | null;
    if (!script) {
      feedback = '\n\nYour previous answer was not valid JSON for the schema. Try again.';
      continue;
    }
    script.id = idea.id;
    const errors = checkScript(script);
    if (errors.length) {
      console.warn(`🔁 #${idea.id} pokus ${attempt}: ${errors.length} chyb – opravuji`);
      feedback = `\n\nA previous attempt had these problems; avoid them:\n- ${errors.join('\n- ')}`;
      continue;
    }
    writeJson(file, script);
    console.log(`✅ #${idea.id} "${script.title.cs}" – ${script.scenes.length} scén, ${secs}s, ${usage}`);
    return;
  }
  console.error(`❌ #${idea.id} se nepodařilo vygenerovat ani na 3 pokusy.`);
};

const main = async () => {
  const {ids, force, concurrency} = parseArgs();
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error('❌ Chybí ANTHROPIC_API_KEY. Zkopíruj .env.example do .env a doplň klíč z https://console.anthropic.com');
    process.exit(1);
  }
  const ideas = loadIdeas().filter((i) => ids.includes(i.id));
  await pool(ideas, concurrency || 3, async (idea) => {
    try {
      await generateOne(idea, force);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) {
        console.error('❌ Chybí nebo neplatný ANTHROPIC_API_KEY (viz .env.example).');
        process.exit(1);
      } else if (e instanceof Anthropic.RateLimitError) console.error(`⏳ #${idea.id} rate limit – zkus to znovu později.`);
      else if (e instanceof Anthropic.APIError) console.error(`❌ #${idea.id} API ${e.status}: ${e.message}`);
      else if (e instanceof Anthropic.AnthropicError) console.error(`❌ #${idea.id} ${e.message}`);
      else throw e;
    }
  });
};

main();
