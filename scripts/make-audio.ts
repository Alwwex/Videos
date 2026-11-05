/**
 * Vygeneruje zvukové efekty a výchozí hudební smyčku (vlastní syntéza = žádné licence).
 *   npx tsx scripts/make-audio.ts
 * Výstup: public/sfx/*.wav, public/music/default-loop.wav
 */
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;

const writeWav = (file: string, data: Float32Array) => {
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 0.85 / peak : 1;
  const buf = Buffer.alloc(44 + data.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + data.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(data.length * 2, 40);
  data.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), 44 + i * 2));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, buf);
  console.log('🔊', path.relative(process.cwd(), file));
};

// deterministický šum
let seed = 1;
const noise = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed / 2147483647) * 2 - 1;
};
const len = (s: number) => new Float32Array(Math.round(s * SR));

/** Přidá do bufferu tón: sinus s frekvencí f(t) a obálkou env(t). */
const addTone = (out: Float32Array, start: number, dur: number, f: (t: number) => number, env: (t: number) => number, amp = 1, harm = 0) => {
  let ph = 0;
  const s0 = Math.round(start * SR);
  for (let i = 0; i < dur * SR && s0 + i < out.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * f(t)) / SR;
    out[s0 + i] += amp * env(t) * (Math.sin(ph) + harm * Math.sin(2 * ph));
  }
};
const addNoise = (out: Float32Array, start: number, dur: number, env: (t: number) => number, amp = 1, cutoff = (_t: number) => 0.5, highpass = false) => {
  let lp = 0;
  const s0 = Math.round(start * SR);
  for (let i = 0; i < dur * SR && s0 + i < out.length; i++) {
    const t = i / SR;
    const n = noise();
    lp += cutoff(t) * (n - lp);
    out[s0 + i] += amp * env(t) * (highpass ? n - lp : lp);
  }
};

const root = path.join(process.cwd(), 'public');

// --- efekty ---
{
  const d = 0.5;
  const w = len(d);
  addNoise(w, 0, d, (t) => Math.sin((Math.PI * t) / d) ** 2, 1, (t) => 0.02 + 0.25 * Math.sin((Math.PI * t) / d));
  writeWav(path.join(root, 'sfx', 'whoosh.wav'), w);
}
{
  const p = len(0.15);
  addTone(p, 0, 0.15, (t) => 300 + 700 * Math.exp(-t * 40), (t) => Math.exp(-t * 30), 1, 0.2);
  writeWav(path.join(root, 'sfx', 'pop.wav'), p);
}
{
  const k = len(0.04);
  addTone(k, 0, 0.04, () => 2200, (t) => Math.exp(-t * 150));
  writeWav(path.join(root, 'sfx', 'tick.wav'), k);
}
{
  const g = len(1);
  addTone(g, 0, 1, () => 1318.5, (t) => Math.exp(-t * 5), 1);
  addTone(g, 0, 1, () => 1975.5, (t) => Math.exp(-t * 7), 0.5);
  writeWav(path.join(root, 'sfx', 'ding.wav'), g);
}
{
  const b = len(1.2);
  addTone(b, 0, 1.2, (t) => 35 + 90 * Math.exp(-t * 8), (t) => Math.exp(-t * 3.5), 1);
  addNoise(b, 0, 0.4, (t) => Math.exp(-t * 12), 0.6, () => 0.05);
  writeWav(path.join(root, 'sfx', 'boom.wav'), b);
}

// --- hudební smyčky: každá má jiné tempo, akordy a barvu zvuku ---
type LoopDef = {name: string; bpm: number; chords: number[][]; timbre: number; bell: boolean; swing: number; drums: 'full' | 'light'};
const LOOPS: LoopDef[] = [
  {name: 'loop-a', bpm: 104, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], timbre: 0.3, bell: false, swing: 0, drums: 'full'}, // Am F C G
  {name: 'loop-b', bpm: 118, chords: [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]], timbre: 0.8, bell: false, swing: 0, drums: 'full'}, // C G Am F
  {name: 'loop-c', bpm: 92, chords: [[50, 53, 57], [55, 58, 62], [48, 52, 55], [53, 57, 60]], timbre: 0.1, bell: true, swing: 0.12, drums: 'light'}, // Dm Gm C F
  {name: 'loop-d', bpm: 126, chords: [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]], timbre: 0.5, bell: true, swing: 0, drums: 'full'}, // Em C G D
];
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
for (const L of LOOPS) {
  const beat = 60 / L.bpm;
  const bars = 8;
  const m = len(bars * 4 * beat);
  for (let bar = 0; bar < bars; bar++) {
    const ch = L.chords[bar % 4];
    for (let b = 0; b < 4; b++) {
      const t = (bar * 4 + b) * beat;
      if (L.drums === 'full' || b === 0) {
        if (b % 2 === 0) addTone(m, t, 0.3, (x) => 45 + 80 * Math.exp(-x * 30), (x) => Math.exp(-x * 9), L.drums === 'full' ? 0.9 : 0.6);
        else addNoise(m, t, 0.15, (x) => Math.exp(-x * 25), 0.35, () => 0.35);
      }
      addTone(m, t, beat * 0.9, () => midi(ch[0] - 12), (x) => Math.min(1, x * 80) * Math.exp(-x * 3), 0.35, 0.4);
      for (const off of [0, 0.5 + L.swing]) addNoise(m, t + off * beat, 0.04, (x) => Math.exp(-x * 90), L.drums === 'full' ? 0.12 : 0.06, () => 0.5, true);
      for (const [k, off] of [0, 0.5 + L.swing].entries()) {
        const note = ch[(b * 2 + k) % 3] + (L.bell ? 24 : 12);
        const decay = L.bell ? 4 : 9;
        addTone(m, t + off * beat, L.bell ? 0.8 : 0.35, () => midi(note), (x) => Math.min(1, x * 200) * Math.exp(-x * decay), L.bell ? 0.1 : 0.16, L.timbre);
      }
    }
  }
  writeWav(path.join(root, 'music', `${L.name}.wav`), m);
}
