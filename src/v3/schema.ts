import {z} from 'zod';
import {CameraSchema, FlowSchema, PropSchema, WavesSchema} from '../engine/schema';
import {VisualSchema} from '../v2/schema';

/* ==========================================================
 *  Schéma hybridních krátkých videí (v3):
 *  3D svět z původních videí + ručně kreslené popisky
 *  + informační karta (graf, číslo, vzorec…) + velké titulky.
 * ========================================================== */

const T = z.object({cs: z.string(), en: z.string(), ro: z.string()});

export const NoteSchema = z.object({
  prop: z.string().describe('id of the prop the hand-drawn arrow points to'),
  text: T.describe('1-3 words, handwritten label'),
});

export const HybridSceneSchema = z.object({
  narration: T.describe('ONE short spoken sentence (5-14 words). Mark 1-2 key words with *asterisks*.'),
  environment: z.enum(['outdoor', 'indoor', 'space']),
  props: z.array(PropSchema),
  flows: z.array(FlowSchema),
  waves: z.array(WavesSchema),
  camera: CameraSchema,
  notes: z.array(NoteSchema).describe('0-2 hand-drawn arrows with labels'),
  card: VisualSchema.nullable().describe('Optional info card at the top (counter, gauge, formula, graph, bars, compare, quiz, steps…)'),
  shake: z.boolean().describe('camera shake for impacts'),
});
export type HybridSceneSpec = z.infer<typeof HybridSceneSchema>;

export const HybridScriptSchema = z.object({
  engine: z.literal('hybrid'),
  id: z.number().int(),
  title: T,
  description: T,
  hashtags: z.array(z.string()),
  hook: T.describe('Huge on-screen hook text for the first seconds, UPPERCASE, max 7 words'),
  scenes: z.array(HybridSceneSchema),
  outro: T.nullable().optional().describe('Short spoken call to follow at the very end (5-10 words), casual and different in every video'),
});
export type HybridScript = z.infer<typeof HybridScriptSchema>;

export const checkHybrid = (s: HybridScript): string[] => {
  const e: string[] = [];
  if (s.scenes.length < 5 || s.scenes.length > 10) e.push(`Need 6-9 scenes, got ${s.scenes.length}.`);
  for (const l of ['cs', 'en', 'ro'] as const) {
    if (s.hook[l].split(/\s+/).length > 9) e.push(`Hook ${l} is too long.`);
  }
  for (const l of ['cs', 'en', 'ro'] as const) {
    if (s.outro && s.outro[l].split(/\s+/).length > 14) e.push(`Outro ${l} is too long.`);
  }
  s.scenes.forEach((sc, i) => {
    const ids = new Set(sc.props.map((p) => p.id));
    if (ids.size !== sc.props.length) e.push(`Scene ${i}: duplicate prop ids.`);
    if (!sc.props.length) e.push(`Scene ${i}: no props.`);
    const ref = (id: string, what: string) => {
      if (!ids.has(id)) e.push(`Scene ${i}: ${what} references unknown prop "${id}".`);
    };
    ref(sc.camera.focus, 'camera.focus');
    sc.flows.forEach((f) => (ref(f.from, 'flow.from'), ref(f.to, 'flow.to')));
    sc.waves.forEach((w) => ref(w.from, 'waves.from'));
    sc.notes.forEach((n) => ref(n.prop, 'note.prop'));
    if (sc.notes.length > 2) e.push(`Scene ${i}: max 2 notes.`);
    if (sc.card?.type === 'outro') e.push(`Scene ${i}: card cannot be "outro".`);
    sc.props.forEach((p) => {
      if (p.position.length !== 3) e.push(`Scene ${i}: prop ${p.id} position must have 3 numbers.`);
      if (p.anim === 'slide' && (!p.slideTo || p.slideTo.length !== 3)) e.push(`Scene ${i}: prop ${p.id} slide needs slideTo.`);
    });
    for (const l of ['cs', 'en', 'ro'] as const) {
      const words = sc.narration[l].split(/\s+/).filter(Boolean).length;
      if (words > 18) e.push(`Scene ${i} ${l}: narration too long (${words} words).`);
    }
  });
  return e;
};
