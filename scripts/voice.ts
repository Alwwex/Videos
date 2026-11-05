/**
 * AI hlas (ElevenLabs): scénář → MP3 pro každou scénu + časová osa slov pro titulky.
 *   npm run voice -- 1-10
 *   npm run voice -- 3 --langs cs --force
 * Výstup: public/generated/NNN/<lang>/sNN.mp3 a content/timelines/NNN.<lang>.json
 */
import fs from 'node:fs';
import path from 'node:path';
import {spokenText, tokenize} from '../src/engine/localize';
import type {Lang, SceneTimeline, Timeline} from '../src/engine/schema';
import {P, loadScript, loadTimeline, pad, parseArgs, pool, timelinePath, writeJson} from './lib';

const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE || 'JBFqnCBsd6RMkjVDRZzb';
const VOICE: Record<Lang, string> = {
  cs: process.env.ELEVENLABS_VOICE_CS || DEFAULT_VOICE,
  en: process.env.ELEVENLABS_VOICE_EN || DEFAULT_VOICE,
  ro: process.env.ELEVENLABS_VOICE_RO || DEFAULT_VOICE,
};

type TtsResponse = {
  audio_base64: string;
  alignment: {characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[]};
};

const tts = async (text: string, lang: Lang, previous: string, next: string): Promise<TtsResponse> => {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE[lang]}/with-timestamps?output_format=mp3_44100_128`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {'xi-api-key': KEY!, 'Content-Type': 'application/json'},
      // previous/next text helps the voice keep natural intonation across scenes
      body: JSON.stringify({
        text,
        model_id: MODEL,
        previous_text: previous || undefined,
        next_text: next || undefined,
        // živější projev: méně stability = víc emocí, style = výraznost, speed = tempo
        voice_settings: {
          stability: Number(process.env.VOICE_STABILITY || 0.32),
          similarity_boost: 0.8,
          style: Number(process.env.VOICE_STYLE || 0.45),
          use_speaker_boost: true,
          speed: Number(process.env.VOICE_SPEED || 1.1),
        },
      }),
    });
    if (res.ok) return (await res.json()) as TtsResponse;
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
};

const voiceOne = async (id: number, lang: Lang, force: boolean) => {
  const script = loadScript(id);
  if (!script) return console.warn(`⏭️  #${id} nemá scénář (spusť npm run generate)`);
  const texts = script.scenes.map((s) => spokenText(s.narration[lang]));
  const old = loadTimeline(id, lang) as (Timeline & {texts?: string[]}) | null;

  const scenes: SceneTimeline[] = [];
  for (let i = 0; i < texts.length; i++) {
    const rel = `generated/${pad(id)}/${lang}/s${pad(i + 1)}.mp3`;
    const abs = path.join(P.audio, '..', rel);
    // cache: stejný text a existující MP3 → nevolej API znovu
    if (!force && old?.texts?.[i] === texts[i] && old.scenes[i]?.audioSrc === rel && fs.existsSync(abs)) {
      scenes.push(old.scenes[i]);
      continue;
    }
    const r = await tts(texts[i], lang, texts[i - 1] ?? '', texts[i + 1] ?? '');
    fs.mkdirSync(path.dirname(abs), {recursive: true});
    fs.writeFileSync(abs, Buffer.from(r.audio_base64, 'base64'));

    // začátek každého slova = čas jeho prvního znaku (text je slova spojená mezerou)
    const words = tokenize(script.scenes[i].narration[lang]);
    const starts = r.alignment.character_start_times_seconds;
    let off = 0;
    const wordStarts = words.map((w) => {
      const s = starts[Math.min(off, starts.length - 1)] ?? 0;
      off += w.text.length + 1;
      return s;
    });
    const end = r.alignment.character_end_times_seconds.at(-1) ?? wordStarts.at(-1) ?? 1;
    scenes.push({audioSrc: rel, durationSec: end + 0.25, wordStarts});
  }
  writeJson(timelinePath(id, lang), {lang, scenes, texts});
  const total = scenes.reduce((n, s) => n + s.durationSec, 0);
  console.log(`🎙️  #${id} ${lang}: ${scenes.length} scén, ${total.toFixed(1)} s`);
};

const main = async () => {
  if (!KEY) {
    console.error('❌ Chybí ELEVENLABS_API_KEY v .env – bez něj se videa renderují bez hlasu (časy se odhadnou).');
    process.exit(1);
  }
  const {ids, langs, force, concurrency} = parseArgs();
  const jobs = ids.flatMap((id) => langs.map((lang) => ({id, lang})));
  await pool(jobs, concurrency || 2, async ({id, lang}) => {
    try {
      await voiceOne(id, lang, force);
    } catch (e) {
      console.error(`❌ #${id} ${lang}: ${(e as Error).message}`);
    }
  });
};

main();
