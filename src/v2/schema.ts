import {z} from 'zod';

/* ==========================================================
 *  Schéma krátkých videí v2 ("blueprint" styl – 2D diagramy).
 *  ~25–35 s, 7–10 scén. Stejné schéma dostává AI jako
 *  structured output, takže co AI vrátí, jde rovnou renderovat.
 * ========================================================== */

export const ICONS = [
  'sun', 'earth', 'moon', 'star', 'eye', 'ear', 'cloud', 'drop', 'lightning', 'speaker',
  'headphones', 'phone', 'router', 'wall', 'ambulance', 'plane', 'ship', 'ball', 'feather',
  'hammer', 'parachute', 'person', 'skater', 'bird', 'satellite', 'clock', 'thermometer',
  'balloon', 'car', 'straw', 'ice', 'skate', 'flame', 'battery', 'coil', 'magnet', 'mirror',
  'hand', 'rocket', 'house', 'wind', 'box', 'atom', 'door', 'wire', 'snowflake', 'mountain',
  'question', 'bulb', 'rain',
] as const;
export type IconName = (typeof ICONS)[number];

export const CURVES = ['linear', 'quadratic', 'sqrt', 'exp', 'decay', 'saturate', 'sine', 'inverse', 'bell', 'flat'] as const;
export type CurveName = (typeof CURVES)[number];

export const ACCENTS = ['yellow', 'teal', 'red', 'blue'] as const;
export type Accent = (typeof ACCENTS)[number];

const T = z.object({cs: z.string(), en: z.string(), ro: z.string()});
export type Text3 = z.infer<typeof T>;
const Icon = z.enum(ICONS);

const IconVisual = z.object({
  type: z.literal('icon'),
  icon: Icon,
  icon2: Icon.nullable().describe('Optional second icon shown next to the first'),
  relation: z.enum(['arrow', 'vs', 'plus', 'none']).describe('What is drawn between icon and icon2'),
  effect: z.enum(['pulse', 'shake', 'spin', 'float', 'none']),
  caption: T.nullable(),
});

const FormulaVisual = z.object({
  type: z.literal('formula'),
  tex: z.string().describe('KaTeX formula. Wrap the key term in \\hl{...} to color it. Example: "F = \\hl{m} \\cdot a"'),
  caption: T.nullable().describe('What the symbols mean, short'),
});

const CounterVisual = z.object({
  type: z.literal('counter'),
  from: z.number(),
  to: z.number(),
  decimals: z.number().int(),
  unit: T.describe('Unit after the number, e.g. " km/h"'),
  caption: T,
});

const GaugeVisual = z.object({
  type: z.literal('gauge'),
  from: z.number(),
  to: z.number(),
  max: z.number(),
  unit: T,
  caption: T,
});

const GraphVisual = z.object({
  type: z.literal('graph'),
  curve: z.enum(CURVES),
  curve2: z.enum(CURVES).nullable().describe('Optional second curve for comparison (drawn dashed)'),
  x: T.describe('x axis label, e.g. "TIME"'),
  y: T.describe('y axis label'),
  markLabel: T.nullable().describe('Label for the moving dot at the end of the curve'),
});

const BarsVisual = z.object({
  type: z.literal('bars'),
  items: z.array(z.object({label: T, value: z.number(), highlight: z.boolean()})).describe('2-4 bars'),
  unit: T,
});

const Side = z.object({icon: Icon, label: T, value: T.nullable()});
const CompareVisual = z.object({
  type: z.literal('compare'),
  left: Side,
  right: Side,
  winner: z.enum(['left', 'right', 'none']),
});

const StepsVisual = z.object({
  type: z.literal('steps'),
  items: z.array(T).describe('2-4 short steps'),
  active: z.number().int().describe('0-based index of the step being explained now'),
});

const ForcesVisual = z.object({
  type: z.literal('forces'),
  body: Icon,
  arrows: z
    .array(
      z.object({
        dir: z.enum(['up', 'down', 'left', 'right', 'upLeft', 'upRight', 'downLeft', 'downRight']),
        size: z.number().describe('relative length 1-3'),
        label: T,
        color: z.enum(ACCENTS),
      }),
    )
    .describe('1-4 force arrows'),
  motion: z.enum(['none', 'up', 'down', 'left', 'right', 'shake']),
});

const WaveVisual = z.object({
  type: z.literal('wave'),
  mode: z.enum(['single', 'compare', 'cancel', 'doppler', 'blocked']),
  label: T.nullable(),
});

const ParticlesVisual = z.object({
  type: z.literal('particles'),
  mode: z.enum(['solid', 'liquid', 'gas', 'hotcold', 'rise', 'pressure', 'evaporate']),
  label: T.nullable(),
});

const OrbitVisual = z.object({
  type: z.literal('orbit'),
  mode: z.enum(['orbit', 'tilt', 'tides', 'spin']),
  center: Icon,
  body: Icon,
  label: T.nullable(),
});

const RaysVisual = z.object({
  type: z.literal('rays'),
  mode: z.enum(['scatter', 'prism', 'refract', 'mirror', 'twinkle', 'sunset']),
  label: T.nullable(),
});

const FieldVisual = z.object({
  type: z.literal('field'),
  mode: z.enum(['magnet', 'coil', 'charge', 'spark']),
  label: T.nullable(),
});

const FallVisual = z.object({
  type: z.literal('fall'),
  left: Icon,
  right: Icon,
  air: z.boolean().describe('true = air slows the light object, false = vacuum, both fall together'),
  label: T.nullable(),
});

const QuizVisual = z.object({
  type: z.literal('quiz'),
  question: T,
  options: z.array(T).describe('2-4 options'),
  answer: z.number().int().describe('0-based index of the correct option'),
});

const OutroVisual = z.object({
  type: z.literal('outro'),
});

export const VisualSchema = z.discriminatedUnion('type', [
  IconVisual, FormulaVisual, CounterVisual, GaugeVisual, GraphVisual, BarsVisual, CompareVisual,
  StepsVisual, ForcesVisual, WaveVisual, ParticlesVisual, OrbitVisual, RaysVisual, FieldVisual,
  FallVisual, QuizVisual, OutroVisual,
]);
export type Visual = z.infer<typeof VisualSchema>;
export type VisualType = Visual['type'];

export const SceneSchema = z.object({
  narration: T.describe('ONE spoken sentence, 4-12 words. Mark 1-2 keywords with *asterisks*.'),
  headline: T.describe('Big on-screen headline, UPPERCASE, 2-5 words. Split into two lines with "|" – the second line is colored.'),
  tag: z.string().nullable().describe('Small technical label above the diagram, UPPERCASE, max 24 chars, e.g. "RAYLEIGH SCATTERING"'),
  accent: z.enum(ACCENTS),
  visual: VisualSchema,
});
export type SceneSpec = z.infer<typeof SceneSchema>;

export const ShortScriptSchema = z.object({
  engine: z.literal('blueprint'),
  id: z.number().int(),
  title: T.describe('Catchy title, max 6 words'),
  description: T.describe('Social media description, 1-2 sentences, may end with 1 emoji'),
  hashtags: z.array(z.string()).describe('5-8 hashtags without #'),
  scenes: z.array(SceneSchema),
});
export type ShortScript = z.infer<typeof ShortScriptSchema>;

export const checkShortScript = (s: ShortScript): string[] => {
  const e: string[] = [];
  if (s.scenes.length < 6 || s.scenes.length > 12) e.push(`Need 7-10 scenes, got ${s.scenes.length}.`);
  if (s.scenes.at(-1)?.visual.type !== 'outro') e.push('The last scene must use the "outro" visual.');
  s.scenes.forEach((sc, i) => {
    for (const l of ['cs', 'en', 'ro'] as const) {
      const words = sc.narration[l].split(/\s+/).filter(Boolean).length;
      if (words > 16) e.push(`Scene ${i} ${l}: narration too long (${words} words).`);
      if (!sc.headline[l].trim()) e.push(`Scene ${i} ${l}: empty headline.`);
    }
    const v = sc.visual;
    if (v.type === 'quiz' && (v.answer < 0 || v.answer >= v.options.length)) e.push(`Scene ${i}: quiz answer out of range.`);
    if (v.type === 'steps' && (v.active < 0 || v.active >= v.items.length)) e.push(`Scene ${i}: steps.active out of range.`);
    if (v.type === 'bars' && (v.items.length < 2 || v.items.length > 4)) e.push(`Scene ${i}: bars need 2-4 items.`);
  });
  return e;
};
