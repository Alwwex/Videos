import {z} from 'zod';

/* ==========================================================
 *  Schéma scénáře videa. Stejné schéma dostává AI (Claude)
 *  jako structured output, takže co AI vrátí, jde rovnou
 *  vyrenderovat.
 * ========================================================== */

export const LANGS = ['cs', 'en', 'ro'] as const;
export type Lang = (typeof LANGS)[number];

export const PROP_TYPES = [
  'sun', 'moon', 'earth', 'cloud', 'tree', 'mountain', 'house', 'car', 'plane', 'rocket',
  'boat', 'hotAirBalloon', 'ball', 'magnet', 'battery', 'bulb', 'phone', 'pot', 'stove',
  'fridge', 'microwave', 'cup', 'iceCube', 'waterPool', 'person', 'arrow', 'arrowUp',
  'arrowDown', 'windTurbine', 'snowflake', 'thermometer', 'speaker', 'satellite',
  'lightning', 'solarPanel', 'atom', 'lens', 'prism', 'table',
  // v3 (hybridní krátká videa)
  'banana', 'clock', 'cat', 'candle', 'candleSpace', 'elevator', 'ant', 'mirror', 'router', 'bird',
  'powerLine', 'balloon', 'paper', 'aquarium', 'headphones', 'weighScale', 'earthCut', 'planet',
  'carGlass', 'astronaut', 'goal',
] as const;
export type PropType = (typeof PROP_TYPES)[number];

const Text3 = z.object({cs: z.string(), en: z.string(), ro: z.string()});

export const PropSchema = z.object({
  id: z.string().describe('Unique id within the scene, e.g. "mw" or "cup1"'),
  type: z.enum(PROP_TYPES),
  position: z.array(z.number()).describe('[x, y, z] in meters, ground is y=0'),
  scale: z.number(),
  rotationY: z.number().describe('Rotation around the vertical axis in degrees'),
  color: z.string().nullable().describe('Optional hex color override like "#ff8844", or null'),
  anim: z.enum(['none', 'spin', 'bob', 'pulse', 'shake', 'slide', 'vanish']),
  slideTo: z.array(z.number()).nullable().describe('[x, y, z] target when anim is "slide", else null'),
  glow: z.boolean(),
});

export const FlowSchema = z.object({
  from: z.string().describe('prop id'),
  to: z.string().describe('prop id'),
  kind: z.enum(['photons', 'electrons', 'heat', 'cold', 'water', 'air', 'sound', 'light', 'microwaves']),
});

export const WavesSchema = z.object({
  from: z.string().describe('prop id'),
  kind: z.enum(['sound', 'radio', 'heat', 'light', 'microwaves']),
});

export const CameraSchema = z.object({
  focus: z.string().describe('prop id the camera looks at'),
  distance: z.number().describe('meters from the focus, typically 3-16'),
  angle: z.enum(['front', 'frontLeft', 'frontRight', 'side', 'top', 'low']),
  move: z.enum(['dollyIn', 'dollyOut', 'orbitLeft', 'orbitRight', 'rise']),
});

export const LabelSchema = z.object({
  prop: z.string().describe('prop id the label points to'),
  emoji: z.string(),
  text: Text3,
});

export const CounterSchema = z.object({
  from: z.number(),
  to: z.number(),
  decimals: z.number().int(),
  unit: Text3.describe('Unit after the number incl. leading space, e.g. " °C"'),
  label: Text3.describe('Short caption under the number'),
});

export const SceneSchema = z.object({
  environment: z.enum(['outdoor', 'indoor', 'space']),
  narration: Text3.describe('Spoken sentence for this scene. Mark 1-2 keywords with *asterisks*.'),
  props: z.array(PropSchema),
  flows: z.array(FlowSchema),
  waves: z.array(WavesSchema),
  camera: CameraSchema,
  labels: z.array(LabelSchema),
  counter: CounterSchema.nullable(),
});

export const VideoScriptSchema = z.object({
  id: z.number().int(),
  title: Text3.describe('Short catchy title, max 6 words'),
  description: Text3.describe('Social media description, 1-2 sentences'),
  hashtags: z.array(z.string()),
  scenes: z.array(SceneSchema),
});

export type PropSpec = z.infer<typeof PropSchema>;
export type FlowSpec = z.infer<typeof FlowSchema>;
export type WavesSpec = z.infer<typeof WavesSchema>;
export type CameraSpec = z.infer<typeof CameraSchema>;
export type SceneSpec = z.infer<typeof SceneSchema>;
export type VideoScript = z.infer<typeof VideoScriptSchema>;

/** Časová osa vygenerovaná z hlasu (TTS). Bez ní se časy odhadnou z délky textu. */
export type SceneTimeline = {audioSrc: string | null; durationSec: number; wordStarts: number[]};
export type Timeline = {lang: Lang; scenes: SceneTimeline[]};

/** Kontroly, které JSON schéma nepohlídá (odkazy na id, délky vektorů). */
export const checkScript = (s: VideoScript): string[] => {
  const errors: string[] = [];
  if (s.scenes.length < 10) errors.push(`Too few scenes (${s.scenes.length}), need 14-18.`);
  s.scenes.forEach((sc, i) => {
    const ids = new Set(sc.props.map((p) => p.id));
    if (ids.size !== sc.props.length) errors.push(`Scene ${i}: duplicate prop ids.`);
    if (sc.props.length === 0) errors.push(`Scene ${i}: no props.`);
    sc.props.forEach((p) => {
      if (p.position.length !== 3) errors.push(`Scene ${i}: prop ${p.id} position must have 3 numbers.`);
      if (p.anim === 'slide' && (!p.slideTo || p.slideTo.length !== 3))
        errors.push(`Scene ${i}: prop ${p.id} anim "slide" needs slideTo with 3 numbers.`);
    });
    const ref = (id: string, what: string) => {
      if (!ids.has(id)) errors.push(`Scene ${i}: ${what} references unknown prop "${id}".`);
    };
    ref(sc.camera.focus, 'camera.focus');
    sc.flows.forEach((f) => (ref(f.from, 'flow.from'), ref(f.to, 'flow.to')));
    sc.waves.forEach((w) => ref(w.from, 'waves.from'));
    sc.labels.forEach((l) => ref(l.prop, 'label.prop'));
    if (sc.labels.length > 2) errors.push(`Scene ${i}: max 2 labels.`);
  });
  return errors;
};
