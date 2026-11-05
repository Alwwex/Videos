/**
 * Hlas: scénář → MP3 pro každou scénu + časování slov pro titulky.
 *   npm run voice -- 15-44                 (auto: ElevenLabs dokud jsou kredity, pak zdarma Edge)
 *   npm run voice -- 15 --provider edge    (vždy zdarma hlas Microsoft Edge)
 *   npm run voice -- 15 --provider elevenlabs
 *   npm run voice -- 3 --langs cs --force
 * Výstup: public/generated/NNN/<lang>/sNN.mp3 a content/timelines/NNN.<lang>.json
 *
 * Volba poskytovatele (.env): VOICE_PROVIDER=auto|elevenlabs|edge
 *   per jazyk: VOICE_PROVIDER_CS / _EN / _RO
 *   ELEVENLABS_RESERVE = kolik znaků v ElevenLabs nechat nevyužitých (výchozí 0)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {MsEdgeTTS, OUTPUT_FORMAT} from 'msedge-tts';
import {spokenText, tokenize} from '../src/engine/localize';
import type {Lang, SceneTimeline, Timeline} from '../src/engine/schema';
import {P, ROOT, loadScript, loadTimeline, pad, parseArgs, timelinePath, writeJson} from './lib';

const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE || 'JBFqnCBsd6RMkjVDRZzb';
const VOICE: Record<Lang, string> = {
  cs: process.env.ELEVENLABS_VOICE_CS || DEFAULT_VOICE,
  en: process.env.ELEVENLABS_VOICE_EN || DEFAULT_VOICE,
  ro: process.env.ELEVENLABS_VOICE_RO || DEFAULT_VOICE,
};
const EDGE_VOICE: Record<Lang, string> = {
  cs: process.env.EDGE_VOICE_CS || 'cs-CZ-AntoninNeural',
  en: process.env.EDGE_VOICE_EN || 'en-US-AndrewNeural',
  ro: process.env.EDGE_VOICE_RO || 'ro-RO-EmilNeural',
};
const EDGE_RATE = process.env.EDGE_RATE || '+10%';

type Provider = 'elevenlabs' | 'edge';
type Mode = Provider | 'auto';
type Voiced = {audio: Buffer; wordStarts: number[]; end: number};

/* ---------------- ElevenLabs ---------------- */
type TtsResponse = {
  audio_base64: string;
  alignment: {characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[]};
};

/** Kolik znaků zbývá v ElevenLabs (null = nevíme). */
export const elevenRemaining = async (): Promise<number | null> => {
  if (!KEY) return null;
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', {headers: {'xi-api-key': KEY}});
    if (!r.ok) return null;
    const j = (await r.json()) as {character_count: number; character_limit: number};
    return Math.max(0, j.character_limit - j.character_count);
  } catch {
    return null;
  }
};

const elevenTts = async (text: string, lang: Lang, previous: string, next: string, narration: string): Promise<Voiced> => {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE[lang]}/with-timestamps?output_format=mp3_44100_128`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {'xi-api-key': KEY!, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        text,
        model_id: MODEL,
        previous_text: previous || undefined,
        next_text: next || undefined,
        voice_settings: {
          stability: Number(process.env.VOICE_STABILITY || 0.32),
          similarity_boost: 0.8,
          style: Number(process.env.VOICE_STYLE || 0.45),
          use_speaker_boost: true,
          speed: Number(process.env.VOICE_SPEED || 1.1),
        },
      }),
    });
    if (res.ok) {
      const r = (await res.json()) as TtsResponse;
      // začátek každého slova = čas jeho prvního znaku (text je slova spojená mezerou)
      const words = tokenize(narration);
      const starts = r.alignment.character_start_times_seconds;
      let off = 0;
      const wordStarts = words.map((w) => {
        const s = starts[Math.min(off, starts.length - 1)] ?? 0;
        off += w.text.length + 1;
        return s;
      });
      const end = r.alignment.character_end_times_seconds.at(-1) ?? wordStarts.at(-1) ?? 1;
      return {audio: Buffer.from(r.audio_base64, 'base64'), wordStarts, end};
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    const body = (await res.text()).slice(0, 300);
    const err = new Error(`ElevenLabs ${res.status}: ${body}`) as Error & {quota?: boolean};
    err.quota = res.status === 401 && /quota|credits/i.test(body);
    throw err;
  }
};

/* ---------------- Microsoft Edge (zdarma) ---------------- */
const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Přiřadí časy slov z Edge (WordBoundary) ke slovům naší narace. */
const alignWords = (ours: string[], bounds: {text: string; start: number}[], end: number): number[] => {
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i < ours.length; i++) {
    const target = norm(ours[i]);
    if (j >= bounds.length || !target) {
      out.push(out.at(-1) !== undefined ? Math.min(end, out.at(-1)! + 0.25) : 0);
      continue;
    }
    out.push(bounds[j].start);
    // jedno naše slovo může být víc hraničních slov (např. "km/h")
    let acc = norm(bounds[j].text);
    j++;
    while (j < bounds.length && acc.length < target.length && target.startsWith(acc + norm(bounds[j].text).slice(0, 1))) {
      acc += norm(bounds[j].text);
      j++;
    }
  }
  return out;
};

let proxyAgent: unknown;
const edgeAgent = async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return undefined;
  if (!proxyAgent) {
    const {HttpsProxyAgent} = await import('https-proxy-agent');
    proxyAgent = new HttpsProxyAgent(proxy);
  }
  return proxyAgent;
};

const edgeTts = async (text: string, lang: Lang, narration: string): Promise<Voiced> => {
  for (let attempt = 1; ; attempt++) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-tts-'));
    try {
      const tts = new MsEdgeTTS({agent: (await edgeAgent()) as never});
      await tts.setMetadata(EDGE_VOICE[lang], OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {wordBoundaryEnabled: true});
      const r = await tts.toFile(dir, text, {rate: EDGE_RATE});
      tts.close();
      const meta = r.metadataFilePath && fs.existsSync(r.metadataFilePath) ? JSON.parse(fs.readFileSync(r.metadataFilePath, 'utf8')) : {Metadata: []};
      const bounds = (meta.Metadata as {Type: string; Data: {Offset: number; Duration: number; text: {Text: string}}}[])
        .filter((m) => m.Type === 'WordBoundary')
        .map((m) => ({text: m.Data.text.Text, start: m.Data.Offset / 1e7, end: (m.Data.Offset + m.Data.Duration) / 1e7}));
      const end = bounds.at(-1)?.end ?? text.length / 14;
      const words = tokenize(narration).map((w) => w.text);
      return {audio: fs.readFileSync(r.audioFilePath), wordStarts: alignWords(words, bounds, end), end};
    } catch (e) {
      if (attempt >= 4) throw new Error(`Edge TTS: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  }
};

/* ---------------- dávka ---------------- */
const modeFor = (lang: Lang, cli: string): Mode => {
  const v = (cli || process.env[`VOICE_PROVIDER_${lang.toUpperCase()}`] || process.env.VOICE_PROVIDER || 'auto').toLowerCase();
  return v === 'edge' || v === 'elevenlabs' ? v : 'auto';
};

const USAGE = path.join(ROOT, 'out', 'voice-usage.json');
const logUsage = (entry: Record<string, unknown>) => {
  let all: unknown[] = [];
  try {
    all = JSON.parse(fs.readFileSync(USAGE, 'utf8'));
  } catch {
    /* první záznam */
  }
  all.push({...entry, at: new Date().toISOString()});
  fs.mkdirSync(path.dirname(USAGE), {recursive: true});
  fs.writeFileSync(USAGE, JSON.stringify(all.slice(-2000), null, 1));
};

const main = async () => {
  const {ids, langs, force, provider} = parseArgs();
  let remaining = await elevenRemaining();
  const reserve = Number(process.env.ELEVENLABS_RESERVE || 0);
  if (KEY) console.log(`🎙️  ElevenLabs: ${remaining === null ? 'nepodařilo se zjistit kredity' : `zbývá ${remaining} znaků`}`);
  else console.log('🎙️  ElevenLabs klíč není nastaven → použije se zdarma hlas Microsoft Edge.');
  let elevenDead = !KEY;

  for (const id of ids) {
    const script = loadScript(id);
    if (!script) {
      console.warn(`⏭️  #${id} nemá scénář`);
      continue;
    }
    for (const lang of langs) {
      const texts = script.scenes.map((s) => spokenText(s.narration[lang]));
      const old = loadTimeline(id, lang) as (Timeline & {texts?: string[]; provider?: string}) | null;
      const allCached =
        !force &&
        old?.texts?.length === texts.length &&
        texts.every((t, i) => old.texts![i] === t && old.scenes[i]?.audioSrc && fs.existsSync(path.join(ROOT, 'public', old.scenes[i].audioSrc!)));
      if (allCached) {
        console.log(`⏭️  #${id} ${lang}: hlas už existuje`);
        continue;
      }
      const chars = texts.join(' ').length;
      const mode = modeFor(lang, provider);
      let use: Provider =
        mode === 'edge' ? 'edge' : mode === 'elevenlabs' ? 'elevenlabs' : !elevenDead && (remaining === null || remaining - chars >= reserve) ? 'elevenlabs' : 'edge';
      if (use === 'elevenlabs' && !KEY) use = 'edge';

      if (use === 'elevenlabs' && elevenDead) {
        console.warn(`⏸️  #${id} ${lang}: ElevenLabs teď nejde (došly kredity?) – přeskakuji, rozdělaná práce zůstává uložená.`);
        continue;
      }

      // jaký hlas má každá už hotová scéna (starší časové osy mají jen jeden společný)
      const oldProv = (i: number): string => (old as {providers?: string[]} | null)?.providers?.[i] ?? old?.provider ?? 'elevenlabs';
      let scenes: SceneTimeline[] = [];
      let providers: string[] = [];
      /** průběžné uložení – když se proces přeruší nebo dojdou kredity, hotové scény se příště nebudou platit znovu */
      const saveProgress = () =>
        writeJson(timelinePath(id, lang), {lang, scenes, texts, provider: use, providers, partial: scenes.length < texts.length});
      let failed = false;
      for (let i = 0; i < texts.length; i++) {
        const rel = `generated/${pad(id)}/${lang}/s${pad(i + 1)}.mp3`;
        const abs = path.join(P.audio, '..', rel);
        // znovu použij hotovou scénu, jen když má stejný text i stejný hlas (ať se ve videu hlasy nemíchají)
        if (!force && old?.texts?.[i] === texts[i] && old.scenes[i]?.audioSrc === rel && fs.existsSync(abs) && oldProv(i) === use) {
          scenes.push(old.scenes[i]);
          providers.push(use);
          continue;
        }
        let r: Voiced;
        try {
          r = use === 'elevenlabs' ? await elevenTts(texts[i], lang, texts[i - 1] ?? '', texts[i + 1] ?? '', script.scenes[i].narration[lang]) : await edgeTts(texts[i], lang, script.scenes[i].narration[lang]);
        } catch (e) {
          const msg = (e as Error).message.slice(0, 160);
          if (use === 'elevenlabs') {
            elevenDead = true;
            if (mode === 'auto') {
              // celé video namluví znovu Edge – jinak by mělo půlku scén jiným hlasem
              console.warn(`⚠️  ElevenLabs selhal (${msg}) → #${id} ${lang} namluvím celé zdarma hlasem Edge`);
              use = 'edge';
              scenes = [];
              providers = [];
              i = -1;
              continue;
            }
            console.error(`⏸️  ElevenLabs selhal (${msg}). ${scenes.length ? `Hotových ${scenes.length} scén #${id} ${lang} je uložených` : 'Nic se neztratilo'} – po doplnění kreditů pusť hlas znovu a naváže se.`);
          } else console.error(`❌ #${id} ${lang}: ${msg}`);
          failed = true;
          break;
        }
        fs.mkdirSync(path.dirname(abs), {recursive: true});
        fs.writeFileSync(abs, r.audio);
        scenes.push({audioSrc: rel, durationSec: r.end + 0.25, wordStarts: r.wordStarts});
        providers.push(use);
        saveProgress();
      }
      if (failed) {
        if (scenes.length) saveProgress();
        continue;
      }
      if (use === 'elevenlabs' && remaining !== null) remaining -= chars;
      saveProgress();
      logUsage({id, lang, provider: use, chars});
      const total = scenes.reduce((n, s) => n + s.durationSec, 0);
      console.log(`🎙️  #${id} ${lang}: ${scenes.length} scén, ${total.toFixed(1)} s (${use === 'edge' ? 'Edge – zdarma' : 'ElevenLabs'})`);
    }
  }
};

main();
