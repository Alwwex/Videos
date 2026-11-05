import type {Lang, SceneSpec, SceneTimeline, Timeline, VideoScript} from './schema';

export type Word = {text: string; highlight: boolean};

/** "*Fotony* dopadají na *křemíkové články*." → slova s příznakem zvýraznění */
export const tokenize = (narration: string): Word[] => {
  const words: Word[] = [];
  let hl = false;
  for (const raw of narration.split(/\s+/).filter(Boolean)) {
    const opens = raw.startsWith('*');
    if (opens) hl = true;
    const text = raw.replace(/\*/g, '');
    if (text) words.push({text, highlight: hl});
    if (raw.replace(/[.,!?;:…"“”]+$/, '').endsWith('*')) hl = false;
  }
  return words;
};

/** Text pro hlasový syntezátor (bez hvězdiček). */
export const spokenText = (narration: string) => tokenize(narration).map((w) => w.text).join(' ');

/** Odhad časování bez TTS (~14 znaků/s). */
export const estimateTimeline = (scene: SceneSpec, lang: Lang): SceneTimeline => {
  const words = tokenize(scene.narration[lang]);
  const cps = 14;
  let chars = 0;
  const wordStarts = words.map((w) => {
    const s = 0.15 + chars / cps;
    chars += w.text.length + 1;
    return s;
  });
  return {audioSrc: null, durationSec: 0.15 + chars / cps + 0.35, wordStarts};
};

/** start = snímek prvního slova; wordStarts = snímek každého slova (vše relativně ke scéně) */
export type Caption = {text: string; start: number; wordStarts: number[]};

/** Rozdělí slova na titulky po 2–4 slovech; start je ve snímcích. */
export const buildCaptions = (words: Word[], wordStarts: number[], fps: number): Caption[] => {
  const out: Caption[] = [];
  let cur: number[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({
      text: cur.map((i) => (words[i].highlight ? `*${words[i].text}*` : words[i].text)).join(' '),
      start: Math.max(0, Math.round((wordStarts[cur[0]] ?? 0) * fps)),
      wordStarts: cur.map((i) => Math.max(0, Math.round((wordStarts[i] ?? 0) * fps))),
    });
    cur = [];
  };
  words.forEach((w, i) => {
    cur.push(i);
    const chars = cur.reduce((n, j) => n + words[j].text.length, 0);
    const punct = /[.,!?;:…]$/.test(w.text);
    const remaining = words.length - i - 1;
    if (remaining === 1 && cur.length < 3) return; // nenechávej osamocené slovo na konci
    if (cur.length >= 4 || (cur.length >= 3 && chars > 14) || (punct && cur.length >= 2)) flush();
  });
  flush();
  return out;
};

export type RenderScene = {
  spec: SceneSpec;
  durationInFrames: number;
  audioSrc: string | null;
  captions: Caption[];
  labels: {prop: string; emoji: string; text: string}[];
  counter: {from: number; to: number; decimals: number; suffix: string; label: string} | null;
};

export const localize = (script: VideoScript, lang: Lang, timeline: Timeline | null, fps: number): RenderScene[] =>
  script.scenes.map((spec, i) => {
    const tl = timeline?.scenes[i] ?? estimateTimeline(spec, lang);
    const words = tokenize(spec.narration[lang]);
    return {
      spec,
      durationInFrames: Math.max(Math.round(2.2 * fps), Math.ceil((tl.durationSec + 0.2) * fps)),
      audioSrc: tl.audioSrc,
      captions: buildCaptions(words, tl.wordStarts, fps),
      labels: spec.labels.map((l) => ({prop: l.prop, emoji: l.emoji, text: l.text[lang]})),
      counter: spec.counter
        ? {
            from: spec.counter.from,
            to: spec.counter.to,
            decimals: spec.counter.decimals,
            suffix: spec.counter.unit[lang],
            label: spec.counter.label[lang],
          }
        : null,
    };
  });

export const SERIES_TITLE: Record<Lang, string> = {
  cs: '🔬 FYZIKA KOLEM TEBE',
  en: '🔬 PHYSICS AROUND YOU',
  ro: '🔬 FIZICA DIN JURUL TĂU',
};

/** Výzva na konci videa. */
export const FOLLOW_CTA: Record<Lang, string> = {
  cs: 'SLEDUJ PRO DALŠÍ DÍL',
  en: 'FOLLOW FOR MORE',
  ro: 'URMĂREȘTE PENTRU MAI MULT',
};
