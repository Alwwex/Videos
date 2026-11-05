/**
 * Hlas: scénář → MP3 + časování slov pro titulky.
 *   npm run voice -- 15-44                 (auto: ElevenLabs dokud jsou kredity, pak zdarma Edge)
 *   npm run voice -- 15 --provider edge    (vždy zdarma hlas Microsoft Edge)
 *   npm run voice -- 3 --langs cs --force
 *
 * Nová videa (engine "hybrid") se namluví NAJEDNOU jako souvislá řeč – žádné pauzy mezi scénami,
 * přirozená intonace. Scény se pak rozdělí podle časů slov. Výstup: public/generated/NNN/<lang>/voice.mp3
 * Starší videa (1–14) mají MP3 pro každou scénu (public/generated/NNN/<lang>/sNN.mp3).
 *
 * Pořadí: nejdřív všechna videa v CZ, pak EN, pak RO – kredity ElevenLabs tak dostane hlavně čeština.
 *
 * .env: VOICE_PROVIDER=auto|elevenlabs|edge (per jazyk VOICE_PROVIDER_CS/_EN/_RO),
 *       ELEVENLABS_VOICE_CS/_EN/_RO (výchozí = vybrané hlasy ze scripts/voices.ts),
 *       ELEVENLABS_RESERVE = kolik znaků v ElevenLabs nechat nevyužitých (výchozí 0)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {MsEdgeTTS, OUTPUT_FORMAT} from 'msedge-tts';
import {spokenText, tokenize} from '../src/engine/localize';
import type {Lang, SceneTimeline, Timeline} from '../src/engine/schema';
import {P, ROOT, loadScript, loadTimeline, pad, parseArgs, timelinePath, writeJson, type AnyScript} from './lib';
import {DEFAULT_VOICE, EDGE_DEFAULT, findVoice} from './voices';

const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const VOICE: Record<Lang, string> = {
  cs: process.env.ELEVENLABS_VOICE_CS || DEFAULT_VOICE.cs,
  en: process.env.ELEVENLABS_VOICE_EN || DEFAULT_VOICE.en,
  ro: process.env.ELEVENLABS_VOICE_RO || DEFAULT_VOICE.ro,
};
const EDGE_VOICE: Record<Lang, string> = {
  cs: process.env.EDGE_VOICE_CS || EDGE_DEFAULT.cs,
  en: process.env.EDGE_VOICE_EN || EDGE_DEFAULT.en,
  ro: process.env.EDGE_VOICE_RO || EDGE_DEFAULT.ro,
};
const EDGE_RATE = process.env.EDGE_RATE || '+10%';

type Provider = 'elevenlabs' | 'edge';
type Mode = Provider | 'auto';
/** Výsledek syntézy: zvuk, začátek každého slova (s) a konec řeči (s). */
type Voiced = {audio: Buffer; wordStarts: number[]; end: number};

const isHybrid = (s: AnyScript) => (s as {engine?: string}).engine === 'hybrid';

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

/** Hlas z veřejné knihovny se musí nejdřív přidat do tvého účtu (jednou). */
const added = new Set<string>();
const addLibraryVoice = async (voiceId: string) => {
  if (added.has(voiceId)) return false;
  added.add(voiceId);
  const v = findVoice(voiceId);
  if (!v) return false;
  const r = await fetch(`https://api.elevenlabs.io/v1/voices/add/${v.owner}/${voiceId}`, {
    method: 'POST',
    headers: {'xi-api-key': KEY!, 'Content-Type': 'application/json'},
    body: JSON.stringify({new_name: `${v.name.split(' - ')[0]} – Fyzika`}),
  });
  if (r.ok) {
    console.log(`➕ Hlas „${v.name}“ jsem přidal do tvé knihovny ElevenLabs.`);
    return true;
  }
  console.warn(`⚠️  Hlas „${v.name}“ se nepodařilo přidat (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return false;
};

const elevenTts = async (text: string, lang: Lang, previous = '', next = ''): Promise<TtsResponse> => {
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
          stability: Number(process.env.VOICE_STABILITY || 0.42),
          similarity_boost: 0.8,
          style: Number(process.env.VOICE_STYLE || 0.3),
          use_speaker_boost: true,
          speed: Number(process.env.VOICE_SPEED || 1.06),
        },
      }),
    });
    if (res.ok) return (await res.json()) as TtsResponse;
    const body = (await res.text()).slice(0, 400);
    // hlas z knihovny ještě není v účtu → přidat a zkusit znovu
    if ((res.status === 400 || res.status === 404) && /voice/i.test(body) && (await addLibraryVoice(VOICE[lang]))) continue;
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    throw new Error(`ElevenLabs ${res.status}: ${body}`);
  }
};

/** Časy slov z časů znaků (text = slova spojená mezerou). */
const wordsFromChars = (words: string[], starts: number[]): number[] => {
  let off = 0;
  return words.map((w) => {
    const s = starts[Math.min(off, starts.length - 1)] ?? 0;
    off += w.length + 1;
    return s;
  });
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

const edgeTts = async (text: string, lang: Lang, words: string[]): Promise<Voiced> => {
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
      return {audio: fs.readFileSync(r.audioFilePath), wordStarts: alignWords(words, bounds, end), end};
    } catch (e) {
      if (attempt >= 4) throw new Error(`Edge TTS: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  }
};

/** Syntéza jednoho textu daným poskytovatelem → zvuk + časy slov. */
const synth = async (use: Provider, text: string, lang: Lang, words: string[], prev = '', next = ''): Promise<Voiced> => {
  if (use === 'edge') return edgeTts(text, lang, words);
  const r = await elevenTts(text, lang, prev, next);
  const wordStarts = wordsFromChars(words, r.alignment.character_start_times_seconds);
  const end = r.alignment.character_end_times_seconds.at(-1) ?? wordStarts.at(-1) ?? 1;
  return {audio: Buffer.from(r.audio_base64, 'base64'), wordStarts, end};
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

type TL = Timeline & {texts?: string[]; provider?: string; providers?: string[]; partial?: boolean; continuous?: boolean; audioSrc?: string | null};
const audioExists = (rel: string | null | undefined) => !!rel && fs.existsSync(path.join(ROOT, 'public', rel));

const main = async () => {
  const {ids, langs, force, provider} = parseArgs();
  let remaining = await elevenRemaining();
  const reserve = Number(process.env.ELEVENLABS_RESERVE || 0);
  if (KEY) console.log(`🎙️  ElevenLabs: ${remaining === null ? 'nepodařilo se zjistit kredity' : `zbývá ${remaining} znaků`}`);
  else console.log('🎙️  ElevenLabs klíč není nastaven → mluví zdarma hlas Microsoft Edge.');
  let elevenDead = !KEY;

  // jazyky ve vnější smyčce: nejdřív celá čeština, pak angličtina, pak rumunština
  for (const lang of langs) {
    for (const id of ids) {
      const script = loadScript(id);
      if (!script) {
        if (lang === langs[0]) console.warn(`⏭️  #${id} nemá scénář`);
        continue;
      }
      const texts = script.scenes.map((s) => spokenText(s.narration[lang]));
      const old = loadTimeline(id, lang) as TL | null;
      const continuous = isHybrid(script);

      const done = continuous
        ? !force && !!old?.continuous && old.texts?.length === texts.length && texts.every((t, i) => old.texts![i] === t) && audioExists(old.audioSrc)
        : !force && old?.texts?.length === texts.length && !old.partial && texts.every((t, i) => old.texts![i] === t && audioExists(old.scenes[i]?.audioSrc));
      if (done) {
        console.log(`⏭️  #${id} ${lang}: hlas už existuje`);
        continue;
      }

      const chars = texts.join(' ').length;
      const mode = modeFor(lang, provider);
      let use: Provider =
        mode === 'edge' ? 'edge' : mode === 'elevenlabs' ? 'elevenlabs' : !elevenDead && (remaining === null || remaining - chars >= reserve) ? 'elevenlabs' : 'edge';
      if (use === 'elevenlabs' && !KEY) use = 'edge';
      if (use === 'elevenlabs' && elevenDead) {
        console.warn(`⏸️  #${id} ${lang}: ElevenLabs teď nejde (došly kredity?) – přeskakuji, nic se neztratilo.`);
        continue;
      }

      try {
        if (continuous) {
          /* ---- celé video najednou ---- */
          const sceneWords = script.scenes.map((s) => tokenize(s.narration[lang]).map((w) => w.text));
          const allWords = sceneWords.flat();
          const full = texts.join(' ');
          let r: Voiced;
          try {
            r = await synth(use, full, lang, allWords);
          } catch (e) {
            if (use !== 'elevenlabs') throw e;
            elevenDead = true;
            if (mode !== 'auto') throw new Error(`ElevenLabs selhal (${(e as Error).message.slice(0, 160)}) – po doplnění kreditů pusť hlas znovu.`);
            console.warn(`⚠️  ElevenLabs selhal (${(e as Error).message.slice(0, 160)}) → #${id} ${lang} namluvím zdarma hlasem Edge`);
            use = 'edge';
            r = await synth(use, full, lang, allWords);
          }
          const rel = `generated/${pad(id)}/${lang}/voice.mp3`;
          const abs = path.join(P.audio, '..', rel);
          fs.mkdirSync(path.dirname(abs), {recursive: true});
          fs.writeFileSync(abs, r.audio);
          // hranice scén = chvilku před prvním slovem každé scény
          const starts: number[] = [];
          let k = 0;
          sceneWords.forEach((ws, i) => {
            const first = r.wordStarts[k] ?? 0;
            const prevLast = k > 0 ? (r.wordStarts[k - 1] ?? 0) : 0;
            starts.push(i === 0 ? 0 : Math.max(prevLast + 0.25, first - 0.08));
            k += ws.length;
          });
          const scenes: (SceneTimeline & {startSec: number})[] = [];
          k = 0;
          sceneWords.forEach((ws, i) => {
            const st = starts[i];
            const end = i + 1 < starts.length ? starts[i + 1] : r.end + 0.5;
            scenes.push({audioSrc: null, startSec: st, durationSec: Math.max(0.4, end - st), wordStarts: ws.map((_, j) => Math.max(0, (r.wordStarts[k + j] ?? st) - st))});
            k += ws.length;
          });
          writeJson(timelinePath(id, lang), {lang, continuous: true, audioSrc: rel, scenes, texts, provider: use});
          const total = scenes.reduce((n, s) => n + s.durationSec, 0);
          console.log(`🎙️  #${id} ${lang}: ${total.toFixed(1)} s souvislé řeči (${use === 'edge' ? 'Edge – zdarma' : 'ElevenLabs'})`);
        } else {
          /* ---- starší videa: MP3 pro každou scénu ---- */
          const oldProv = (i: number): string => old?.providers?.[i] ?? old?.provider ?? 'elevenlabs';
          let scenes: SceneTimeline[] = [];
          let providers: string[] = [];
          const saveProgress = () => writeJson(timelinePath(id, lang), {lang, scenes, texts, provider: use, providers, partial: scenes.length < texts.length});
          for (let i = 0; i < texts.length; i++) {
            const rel = `generated/${pad(id)}/${lang}/s${pad(i + 1)}.mp3`;
            const abs = path.join(P.audio, '..', rel);
            if (!force && old?.texts?.[i] === texts[i] && old.scenes[i]?.audioSrc === rel && fs.existsSync(abs) && oldProv(i) === use) {
              scenes.push(old.scenes[i]);
              providers.push(use);
              continue;
            }
            const words = tokenize(script.scenes[i].narration[lang]).map((w) => w.text);
            let r: Voiced;
            try {
              r = await synth(use, texts[i], lang, words, texts[i - 1] ?? '', texts[i + 1] ?? '');
            } catch (e) {
              if (use !== 'elevenlabs') throw e;
              elevenDead = true;
              if (mode !== 'auto') {
                if (scenes.length) saveProgress();
                throw new Error(`ElevenLabs selhal (${(e as Error).message.slice(0, 160)}). Hotové scény jsou uložené – po doplnění kreditů pusť hlas znovu.`);
              }
              console.warn(`⚠️  ElevenLabs selhal → #${id} ${lang} namluvím celé zdarma hlasem Edge`);
              use = 'edge';
              scenes = [];
              providers = [];
              i = -1;
              continue;
            }
            fs.mkdirSync(path.dirname(abs), {recursive: true});
            fs.writeFileSync(abs, r.audio);
            scenes.push({audioSrc: rel, durationSec: r.end + 0.25, wordStarts: r.wordStarts});
            providers.push(use);
            saveProgress();
          }
          const total = scenes.reduce((n, s) => n + s.durationSec, 0);
          console.log(`🎙️  #${id} ${lang}: ${scenes.length} scén, ${total.toFixed(1)} s (${use === 'edge' ? 'Edge – zdarma' : 'ElevenLabs'})`);
        }
        if (use === 'elevenlabs' && remaining !== null) remaining -= chars;
        logUsage({id, lang, provider: use, chars});
      } catch (e) {
        console.error(`❌ #${id} ${lang}: ${(e as Error).message}`);
      }
    }
  }
};

main();
