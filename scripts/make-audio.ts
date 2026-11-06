/**
 * Vygeneruje zvukové efekty a hudbu (vlastní syntéza = žádné licence).
 *   npx tsx scripts/make-audio.ts
 * Výstup: public/sfx/*.wav, public/music/loop-*.wav (starší videa), public/music/cine-*.mp3 (nová videa)
 */
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg} from './lib';

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

/* =====================================================================
 *  Nová videa (engine "hybrid"): výraznější efekty + hudba s „dropem“
 * ===================================================================== */

/** Pásmový šum, střed pásma se může v čase měnit (c = koeficient 0–1). */
const addBand = (out: Float32Array, start: number, dur: number, env: (t: number) => number, center: (t: number) => number, amp = 1) => {
  let a = 0;
  let b = 0;
  const s0 = Math.round(start * SR);
  for (let i = 0; i < dur * SR && s0 + i < out.length; i++) {
    const t = i / SR;
    const c = Math.min(0.95, center(t));
    a += c * (noise() - a);
    b += c * 0.3 * (a - b);
    out[s0 + i] += amp * env(t) * (a - b);
  }
};
/** Normalizace + měkké oříznutí špiček (hlasitější, „produkovaný“ zvuk). */
const softClip = (buf: Float32Array, drive: number) => {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? 1 / peak : 1;
  const k = Math.tanh(drive);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * g * drive) / k;
  return buf;
};

{
  // švih při střihu záběru
  const d = 0.3;
  const w = len(d);
  addBand(w, 0, d, (t) => (t / d < 0.55 ? (t / d / 0.55) ** 1.5 : Math.max(0, 1 - (t / d - 0.55) / 0.45) ** 2), (t) => 0.05 + 0.6 * (t / d) ** 1.3);
  writeWav(path.join(root, 'sfx', 'swish.wav'), w);
}
{
  // filmová rána (klíčová slova, pointa)
  const d = 1.1;
  const h = len(d);
  addTone(h, 0, d, (t) => 50 + 80 * Math.exp(-t * 14), (t) => Math.min(1, t * 400) * Math.exp(-t * 3.2), 1);
  addTone(h, 0, 0.4, (t) => 70 + 140 * Math.exp(-t * 9), (t) => Math.exp(-t * 15), 0.55, 0.3);
  addNoise(h, 0, 0.05, (t) => Math.exp(-t * 110), 0.8, () => 0.5, true);
  addBand(h, 0, 0.35, (t) => Math.exp(-t * 20), () => 0.25, 0.9);
  addNoise(h, 0, d, (t) => Math.exp(-t * 4.5), 0.25, () => 0.03);
  writeWav(path.join(root, 'sfx', 'hit.wav'), softClip(h, 1.6));
}
{
  // náběh před pointou – vrchol přesně na konci souboru
  const d = 1.4;
  const r = len(d);
  const env = (p: number) => (t: number) => (t / d) ** p * Math.min(1, Math.max(0, (d - t) / 0.012));
  addNoise(r, 0, d, env(2.2), 0.9, (t) => 0.01 + 0.5 * (t / d) ** 2);
  addNoise(r, 0, d, env(3), 0.35, () => 0.5, true);
  addTone(r, 0, d, (t) => 160 * 2 ** (2.6 * (t / d)) * (1 + 0.012 * Math.sin(t * 2 * Math.PI * (4 + (6 * t) / d))), env(1.6), 0.4, 0.3);
  addTone(r, 0, d, (t) => 240 * 2 ** (2.6 * (t / d)), env(1.8), 0.22);
  writeWav(path.join(root, 'sfx', 'riser.wav'), r);
}
{
  // jiskřičky u závěrečné karty
  const d = 1.3;
  const sp = len(d);
  const notes = [84, 86, 88, 91, 93, 96, 98, 100];
  const rnd01 = () => noise() * 0.5 + 0.5;
  for (let k = 0; k < 11; k++) {
    const t0 = 0.02 + k * 0.055 + rnd01() * 0.02;
    const n = notes[Math.floor(rnd01() * notes.length) % notes.length];
    const a = 0.25 + rnd01() * 0.25;
    addTone(sp, t0, 0.7, () => midi(n), (t) => Math.min(1, t * 900) * Math.exp(-t * 7), a, 0.12);
    addTone(sp, t0, 0.4, () => midi(n) * 2.76, (t) => Math.exp(-t * 16), a * 0.25);
  }
  addNoise(sp, 0, 0.9, (t) => Math.sin(Math.PI * Math.min(1, t / 0.9)) * 0.5, 0.12, () => 0.5, true);
  writeWav(path.join(root, 'sfx', 'sparkle.wav'), sp);
}
{
  // ťuknutí na „Sledovat“ + potvrzovací cinknutí
  const d = 0.6;
  const tp = len(d);
  addTone(tp, 0, 0.03, () => 2600, (t) => Math.exp(-t * 260), 0.6);
  addNoise(tp, 0, 0.02, (t) => Math.exp(-t * 300), 0.5, () => 0.5, true);
  addTone(tp, 0, 0.12, (t) => 520 + 500 * Math.exp(-t * 45), (t) => Math.exp(-t * 34), 0.55);
  addTone(tp, 0.07, 0.5, () => 1318.5, (t) => Math.min(1, t * 600) * Math.exp(-t * 9), 0.32, 0.1);
  addTone(tp, 0.14, 0.45, () => 1975.5, (t) => Math.min(1, t * 600) * Math.exp(-t * 9), 0.28, 0.1);
  writeWav(path.join(root, 'sfx', 'tap.wav'), tp);
}

/* ---------- hudba cine-*: 24 taktů = groove (1–8), přitvrdí (9–16), DROP (17–24) ----------
 * Video skočí na takt 17 přesně v pointě (viz src/v3/HybridVideo.tsx → CINE_MUSIC).
 * Dozvuky z konce se přičtou na začátek → smyčka bez švu. */
type Ctx = {s16: number; drums: Float32Array; bass: Float32Array; keys: Float32Array; pad: Float32Array; lead: Float32Array; kicks: number[]};

const kick = (c: Ctx, t: number, amp = 1) => {
  addTone(c.drums, t, 0.45, (x) => 44 + 130 * Math.exp(-x * 30), (x) => Math.min(1, x * 1500) * Math.exp(-x * 6), amp);
  addNoise(c.drums, t, 0.015, (x) => Math.exp(-x * 350), 0.3 * amp, () => 0.6, true);
  c.kicks.push(t);
};
const clap = (c: Ctx, t: number, amp = 1) => {
  for (const o of [0, 0.009, 0.019]) addBand(c.drums, t + o, 0.03, (x) => Math.exp(-x * 160), () => 0.34, amp * 0.8);
  addBand(c.drums, t + 0.028, 0.3, (x) => Math.exp(-x * 15), () => 0.3, amp * 0.75);
};
const snare = (c: Ctx, t: number, amp = 1) => {
  addTone(c.drums, t, 0.18, (x) => 185 + 60 * Math.exp(-x * 40), (x) => Math.exp(-x * 22), amp * 0.6);
  addBand(c.drums, t, 0.3, (x) => Math.exp(-x * 13), () => 0.5, amp * 0.9);
};
const hat = (c: Ctx, t: number, amp: number, open = false) =>
  addNoise(c.drums, t, open ? 0.28 : 0.05, (x) => Math.exp(-x * (open ? 12 : 85)), amp * 1.4, () => 0.62, true);
const shaker = (c: Ctx, t: number, amp: number) => addBand(c.drums, t, 0.07, (x) => Math.min(1, x * 300) * Math.exp(-x * 55), () => 0.85, amp);
const rim = (c: Ctx, t: number, amp: number) => {
  addTone(c.drums, t, 0.05, () => 1750, (x) => Math.exp(-x * 120), amp * 0.5);
  addBand(c.drums, t, 0.05, (x) => Math.exp(-x * 90), () => 0.6, amp * 0.6);
};
const tom = (c: Ctx, t: number, f0: number, amp: number) => addTone(c.drums, t, 0.4, (x) => f0 * (1 + 0.5 * Math.exp(-x * 25)), (x) => Math.exp(-x * 8), amp, 0.2);
const sweep = (c: Ctx, t: number, dur: number, amp: number) => addNoise(c.lead, t, dur, (x) => (x / dur) ** 2, amp, (x) => 0.02 + 0.4 * (x / dur) ** 2);

/** Basa: sytý sinus – saturace přidá vyšší harmonické, takže je slyšet i z mobilu. */
const bassNote = (buf: Float32Array, t0: number, dur: number, note: number, amp: number, drive = 2, glideFrom?: number) => {
  const s0 = Math.round(t0 * SR);
  const k = Math.tanh(drive);
  let ph = 0;
  for (let i = 0; i < dur * SR && s0 + i < buf.length; i++) {
    const t = i / SR;
    const f = glideFrom !== undefined ? midi(note) + (midi(glideFrom) - midi(note)) * Math.exp(-t * 22) : midi(note);
    ph += (2 * Math.PI * f) / SR;
    const env = Math.min(1, t * 400) * Math.min(1, Math.max(0, (dur - t) / 0.03));
    buf[s0 + i] += (amp * env * Math.tanh(drive * Math.sin(ph))) / k;
  }
};
const low = (note: number) => {
  let n = note - 24;
  while (n < 28) n += 12;
  return n;
};
/** Drnknutí (pila s rychle tlumenými vyššími harmonickými). */
const pluck = (buf: Float32Array, t0: number, dur: number, note: number, amp: number, decay = 9, bright = 7) => {
  const s0 = Math.round(t0 * SR);
  const w = 2 * Math.PI * midi(note);
  for (let i = 0; i < dur * SR && s0 + i < buf.length; i++) {
    const t = i / SR;
    let v = 0;
    for (let h = 1; h <= bright; h++) v += (Math.sin(h * w * t) / h) * Math.exp(-t * decay * (0.5 + 0.4 * h));
    buf[s0 + i] += amp * Math.min(1, t * 1500) * Math.min(1, Math.max(0, (dur - t) / 0.01)) * v;
  }
};
/** Zvonek (FM). */
const bell = (buf: Float32Array, t0: number, dur: number, note: number, amp: number) => {
  const s0 = Math.round(t0 * SR);
  const w = 2 * Math.PI * midi(note);
  for (let i = 0; i < dur * SR && s0 + i < buf.length; i++) {
    const t = i / SR;
    buf[s0 + i] += amp * Math.min(1, t * 2000) * Math.exp(-t * 4.5) * Math.sin(w * t + 1.3 * Math.exp(-t * 6) * Math.sin(3.5 * w * t));
  }
};
/** Marimba (dřevěný úder). */
const marimba = (buf: Float32Array, t0: number, note: number, amp: number) => {
  const s0 = Math.round(t0 * SR);
  const w = 2 * Math.PI * midi(note);
  for (let i = 0; i < 0.6 * SR && s0 + i < buf.length; i++) {
    const t = i / SR;
    buf[s0 + i] += amp * Math.min(1, t * 3000) * Math.exp(-t * 10) * (Math.sin(w * t) + 0.3 * Math.sin(4 * w * t) * Math.exp(-t * 40));
  }
};
/** Plocha (rozladěné pily, pomalý nástup). */
const padChord = (buf: Float32Array, t0: number, dur: number, notes: number[], amp: number) => {
  const s0 = Math.round(t0 * SR);
  notes.forEach((note, j) => {
    for (const det of [-0.0045, 0, 0.005]) {
      const w = 2 * Math.PI * midi(note) * (1 + det);
      const p0 = j * 1.7 + det * 400;
      for (let i = 0; i < dur * SR && s0 + i < buf.length; i++) {
        const t = i / SR;
        const ph = w * t + p0;
        const env = Math.min(1, t / 0.35) * Math.min(1, Math.max(0, (dur - t) / 0.35));
        buf[s0 + i] += (amp * env * (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph) + 0.1 * Math.sin(4 * ph))) / (notes.length * 3);
      }
    }
  });
};

const onePole = (buf: Float32Array, c: number) => {
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += c * (buf[i] - y);
    buf[i] = y;
  }
  return buf;
};
const echo = (buf: Float32Array, sec: number, fb: number, mix: number) => {
  const d = Math.round(sec * SR);
  const wet = new Float32Array(buf.length);
  for (let i = d; i < buf.length; i++) wet[i] = buf[i - d] + fb * wet[i - d];
  for (let i = 0; i < buf.length; i++) buf[i] += mix * wet[i];
  return buf;
};
const room = (buf: Float32Array, mix: number) => {
  const wet = new Float32Array(buf.length);
  for (const [sec, fb] of [[0.0297, 0.72], [0.0371, 0.7], [0.0411, 0.68], [0.0437, 0.66]]) {
    const d = Math.round(sec * SR);
    const comb = new Float32Array(buf.length);
    for (let i = d; i < buf.length; i++) comb[i] = buf[i - d] + fb * comb[i - d];
    for (let i = 0; i < buf.length; i++) wet[i] += comb[i] / 4;
  }
  onePole(wet, 0.25);
  for (let i = 0; i < buf.length; i++) buf[i] += mix * wet[i];
  return buf;
};
const rms = (buf: Float32Array) => {
  let s = 0;
  for (const v of buf) s += v * v;
  return Math.sqrt(s / Math.max(1, buf.length));
};
/** Basa a melodie uhnou kopáku (sidechain) – typický „pumpující“ zvuk. */
const duckEnv = (n: number, kicks: number[], depth: number, rel = 7) => {
  const g = new Float32Array(n).fill(1);
  for (const tk of kicks) {
    const s0 = Math.round(tk * SR);
    for (let i = 0; i < 0.45 * SR && s0 + i < n; i++) {
      const t = i / SR;
      const d = depth * (t < 0.006 ? t / 0.006 : Math.exp(-(t - 0.006) * rel));
      g[s0 + i] = Math.min(g[s0 + i], 1 - d);
    }
  }
  return g;
};

const BARS = 24;
const sectionOf = (bar: number) => (bar < 8 ? 0 : bar < 16 ? 1 : 2);
const song = (name: string, bpm: number, body: (c: Ctx) => void, opt: {duck: number; mix: [number, number, number, number, number]}) => {
  const s16 = 60 / bpm / 4;
  const loopLen = Math.round(BARS * 16 * s16 * SR);
  const n = loopLen + Math.round(3 * SR);
  const c: Ctx = {s16, drums: len(n / SR), bass: len(n / SR), keys: len(n / SR), pad: len(n / SR), lead: len(n / SR), kicks: []};
  body(c);
  room(c.drums, 0.16);
  echo(c.keys, s16 * 3, 0.3, 0.3);
  echo(c.lead, s16 * 3, 0.38, 0.4);
  room(c.lead, 0.25);
  onePole(c.pad, 0.08);
  // jednoduchý „mix“: každá stopa na cílovou hlasitost
  const buses = [c.drums, c.bass, c.keys, c.pad, c.lead];
  const gains = buses.map((b, i) => (rms(b) > 1e-6 ? opt.mix[i] / rms(b) : 0));
  const g = duckEnv(n, c.kicks, opt.duck);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = c.drums[i] * gains[0] + g[i] * (c.bass[i] * gains[1] + c.keys[i] * gains[2] + c.pad[i] * gains[3] + c.lead[i] * gains[4]);
  // pryč se zbytečným hlubokým dunivým pásmem (mobil ho stejně nezahraje)
  const a = 1 / (1 + (2 * Math.PI * 32) / SR);
  for (let i = 1, px = out[0], py = out[0]; i < n; i++) {
    const y = a * (py + out[i] - px);
    px = out[i];
    out[i] = py = y;
  }
  const loop = out.slice(0, loopLen);
  for (let i = 0; i < n - loopLen; i++) loop[i] += out[loopLen + i];
  const wav = path.join(root, 'music', `${name}.wav`);
  writeWav(wav, softClip(loop, 1.5));
  // MP3 je 10× menší; když ffmpeg není po ruce, zůstane WAV
  try {
    const mp3 = wav.replace(/\.wav$/, '.mp3');
    ffmpeg(['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '192k', mp3]);
    fs.rmSync(wav);
    console.log('🎵', path.relative(process.cwd(), mp3));
  } catch {
    console.warn(`⚠️  ${name}: převod do MP3 se nepovedl, nechávám WAV`);
  }
};

// cine-a: „drive“ – 124 BPM, Am F C G, house groove s pumpující basou
song(
  'cine-a',
  124,
  (c) => {
    const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    for (let bar = 0; bar < BARS; bar++) {
      const sec = sectionOf(bar);
      const ch = CH[bar % 4];
      const t0 = bar * 16 * c.s16;
      const fill = bar % 8 === 7;
      for (let st = 0; st < 16; st++) {
        const t = t0 + st * c.s16;
        if (st % 4 === 0 && !(fill && st === 12)) kick(c, t, sec === 2 ? 1 : 0.92);
        if (st === 4 || st === 12) clap(c, t, sec === 0 ? 0.75 : 0.9);
        if (fill && st >= 13) clap(c, t, 0.45 + 0.15 * (st - 13));
        if (st % 4 === 2) hat(c, t, sec === 0 ? 0.16 : 0.22, true);
        else hat(c, t, st % 2 ? 0.06 : 0.1);
        if (st % 4 === 2) bassNote(c.bass, t, c.s16 * 1.6, low(ch[0]), 1, 2.2);
        if (sec === 2 && st % 4 === 3) bassNote(c.bass, t, c.s16 * 0.8, low(ch[0]) + 12, 0.6, 2.2);
        const order = [0, 1, 2, 1, 2, 0, 1, 2];
        if (sec > 0 || st % 2 === 0) pluck(c.keys, t, 0.3, ch[order[st % 8]] + 12 + (sec === 2 && st % 2 ? 12 : 0), 1, 10, 7);
      }
      padChord(c.pad, t0, 16 * c.s16 + 0.15, ch.map((x) => x + (sec === 2 ? 12 : 0)), sec === 0 ? 0.6 : 1);
      if (sec === 2) {
        const mel: [number, number, number][] = [[0, 2, 3], [3, 1, 3], [6, 0, 4], [10, 1, 2], [12, 2, 4]];
        for (const [st, idx, l] of mel) bell(c.lead, t0 + st * c.s16, l * c.s16 + 0.3, ch[idx] + 24, 1);
      } else if (sec === 1 && bar % 2 === 1) bell(c.lead, t0, 0.9, ch[2] + 24, 0.7);
      if (fill) sweep(c, t0 + 8 * c.s16, 8 * c.s16, 0.5);
    }
  },
  {duck: 0.55, mix: [0.2, 0.1, 0.11, 0.07, 0.1]},
);

// cine-b: „trap“ – 140 BPM v polovičním tempu, Fm Db Ab Eb, 808 basa a zvonky
song(
  'cine-b',
  140,
  (c) => {
    const CH = [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]];
    for (let bar = 0; bar < BARS; bar++) {
      const sec = sectionOf(bar);
      const ch = CH[bar % 4];
      const t0 = bar * 16 * c.s16;
      const kp = bar % 2 === 0 ? [0, 7, 10] : [0, 3, 10, 13];
      kp.forEach((st, k) => {
        const t = t0 + st * c.s16;
        kick(c, t, 1);
        const next = kp[k + 1] ?? 16;
        const glide = bar % 2 === 1 && st === 10 ? low(ch[0]) + 7 : undefined;
        bassNote(c.bass, t, (next - st) * c.s16 * 0.95, low(ch[0]) + (st === 10 && bar % 2 === 1 ? 0 : 0), 1, 2.6, glide);
      });
      clap(c, t0 + 8 * c.s16, 1);
      snare(c, t0 + 8 * c.s16, 0.5);
      for (let st = 0; st < 16; st += 2) {
        const roll = bar % 4 === 3 && st >= 12 && sec > 0;
        hat(c, t0 + st * c.s16, 0.1);
        if (roll) for (const o of [0.5, 1, 1.5]) hat(c, t0 + (st + o) * c.s16, 0.07);
        if (sec >= 1 && (st === 6 || st === 14)) hat(c, t0 + st * c.s16, 0.12, true);
      }
      const motif: [number, number][] = sec === 0 ? [[0, 2], [6, 1], [10, 0]] : [[0, 2], [3, 1], [6, 2], [8, 0], [11, 1], [14, 2]];
      for (const [st, idx] of motif) bell(c.lead, t0 + st * c.s16, 0.9, ch[idx] + (sec === 2 ? 24 : 12), sec === 2 ? 1 : 0.75);
      if (sec >= 1) for (let st = 0; st < 16; st += 4) pluck(c.keys, t0 + st * c.s16, 0.25, ch[(st / 4) % 3] + 24, 0.8, 12, 5);
      padChord(c.pad, t0, 16 * c.s16 + 0.15, ch, sec === 2 ? 1 : 0.7);
      if (bar % 8 === 7) sweep(c, t0 + 8 * c.s16, 8 * c.s16, 0.5);
    }
  },
  {duck: 0.4, mix: [0.2, 0.12, 0.07, 0.07, 0.11]},
);

// cine-c: „zvědavá“ – 112 BPM, Dm Bb F C, marimba, švih, hravé
song(
  'cine-c',
  112,
  (c) => {
    const CH = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]];
    for (let bar = 0; bar < BARS; bar++) {
      const sec = sectionOf(bar);
      const ch = CH[bar % 4];
      const t0 = bar * 16 * c.s16;
      const fill = bar % 8 === 7;
      for (let st = 0; st < 16; st++) {
        const t = t0 + st * c.s16 + (st % 2 ? c.s16 * 0.16 : 0);
        if (st === 0 || st === 8 || (bar % 2 === 1 && st === 10) || (sec === 2 && st % 4 === 0)) kick(c, t, 0.85);
        if (st === 4 || st === 12) {
          rim(c, t, 0.9);
          if (sec >= 1) clap(c, t, 0.6);
        }
        if (fill && st >= 13) rim(c, t, 0.5 + 0.12 * (st - 13));
        shaker(c, t, (st % 2 ? 0.05 : 0.08) * (sec === 0 ? 0.8 : 1));
        if ([0, 6, 8, 14].includes(st)) bassNote(c.bass, t, c.s16 * 1.2, low(ch[0]) + (st === 6 || st === 14 ? 7 : 0), 1, 1.4);
        const hits = sec === 0 ? [0, 3, 6, 8, 11, 14] : [0, 2, 3, 6, 8, 10, 11, 14];
        if (hits.includes(st)) marimba(c.keys, t, ch[(st * 2) % 3] + 12 + (st % 3 === 2 ? 12 : 0), 1);
      }
      if (sec >= 1) {
        bell(c.lead, t0, 1, ch[2] + 24, 0.6);
        bell(c.lead, t0 + 8 * c.s16, 1, ch[1] + 24, 0.5);
      }
      if (sec === 2) for (const [st, idx] of [[2, 0], [5, 1], [9, 2], [13, 1]] as const) pluck(c.lead, t0 + st * c.s16, 0.4, ch[idx] + 24, 0.9, 8, 6);
      padChord(c.pad, t0, 16 * c.s16 + 0.15, ch, sec === 0 ? 0.4 : 0.7);
    }
  },
  {duck: 0.3, mix: [0.17, 0.09, 0.13, 0.06, 0.09]},
);

// cine-d: „puls“ – 120 BPM, Em C G D, filmové bicí, osminová basa, arpeggio s ozvěnou
song(
  'cine-d',
  120,
  (c) => {
    const CH = [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]];
    for (let bar = 0; bar < BARS; bar++) {
      const sec = sectionOf(bar);
      const ch = CH[bar % 4];
      const t0 = bar * 16 * c.s16;
      const fill = bar % 8 === 7;
      for (let st = 0; st < 16; st++) {
        const t = t0 + st * c.s16;
        if (sec === 0 ? st === 0 || st === 8 : st % 4 === 0) kick(c, t, 1);
        if (fill && st >= 8) {
          tom(c, t, 200 - (st - 8) * 14, 0.8);
        } else {
          if (st === 4 || st === 12) {
            snare(c, t, 0.9);
            if (sec === 2) clap(c, t, 0.6);
          }
          hat(c, t, st % 2 ? 0.05 : 0.08);
          if (sec >= 1 && st % 4 === 2) hat(c, t, 0.14, true);
        }
        if (st % 2 === 0) bassNote(c.bass, t, c.s16 * 1.7, low(ch[0]) + (sec >= 1 && st % 4 === 2 ? 12 : 0), 1, 2.4);
        const up = [ch[0], ch[1], ch[2], ch[0] + 12];
        pluck(c.keys, t, 0.28, up[st % 4] + 12, sec === 0 && st % 2 ? 0.6 : 1, 8, 8);
      }
      padChord(c.pad, t0, 16 * c.s16 + 0.15, ch, sec === 0 ? 0.5 : 1);
      if (sec === 2) for (const [st, idx] of [[0, 2], [3, 1], [6, 0], [8, 1], [11, 2], [14, 3]] as const) bell(c.lead, t0 + st * c.s16, 0.9, (idx === 3 ? ch[0] + 12 : ch[idx]) + 24, 1);
      if (fill) sweep(c, t0 + 8 * c.s16, 8 * c.s16, 0.5);
    }
  },
  {duck: 0.45, mix: [0.2, 0.1, 0.11, 0.08, 0.1]},
);
