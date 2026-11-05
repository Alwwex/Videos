import React, {createContext, useContext} from 'react';
import type {IconName} from './schema';

/* Knihovna čárových piktogramů (viewBox 100×100). Kreslí se "perem":
 * t = 0…1 je postup kreslení, a = barva zvýraznění (výplně). */

type Ctx = {t: number; a: string; ink: string};
const DrawCtx = createContext<Ctx>({t: 1, a: '#FFC83D', ink: '#fff'});

const useDash = () => {
  const {t} = useContext(DrawCtx);
  return {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - t};
};
const P: React.FC<{d: string; fill?: boolean; accent?: boolean}> = ({d, fill, accent}) => {
  const c = useContext(DrawCtx);
  const dash = useDash();
  return (
    <path
      d={d}
      {...dash}
      stroke={accent ? c.a : c.ink}
      fill={fill ? (accent ? c.a : c.ink) : 'none'}
      fillOpacity={fill ? Math.max(0, c.t * 1.6 - 0.6) * (accent ? 0.9 : 0.18) : 0}
    />
  );
};
const C: React.FC<{x: number; y: number; r: number; fill?: boolean; accent?: boolean}> = ({x, y, r, fill, accent}) => {
  const c = useContext(DrawCtx);
  const dash = useDash();
  return (
    <circle
      cx={x}
      cy={y}
      r={r}
      {...dash}
      stroke={accent ? c.a : c.ink}
      fill={fill ? (accent ? c.a : c.ink) : 'none'}
      fillOpacity={fill ? Math.max(0, c.t * 1.6 - 0.6) * (accent ? 0.9 : 0.18) : 0}
    />
  );
};
const R: React.FC<{x: number; y: number; w: number; h: number; r?: number; fill?: boolean; accent?: boolean}> = ({x, y, w, h, r = 3, fill, accent}) => {
  const c = useContext(DrawCtx);
  const dash = useDash();
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={r}
      {...dash}
      stroke={accent ? c.a : c.ink}
      fill={fill ? (accent ? c.a : c.ink) : 'none'}
      fillOpacity={fill ? Math.max(0, c.t * 1.6 - 0.6) * (accent ? 0.9 : 0.18) : 0}
    />
  );
};

const rays = (cx: number, cy: number, r1: number, r2: number, n: number) =>
  Array.from({length: n}, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return `M${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}L${cx + Math.cos(a) * r2} ${cy + Math.sin(a) * r2}`;
  }).join('');

const ICON_DRAW: Record<IconName, () => React.ReactNode> = {
  sun: () => (
    <>
      <C x={50} y={50} r={20} fill accent />
      <P d={rays(50, 50, 28, 40, 12)} accent />
    </>
  ),
  earth: () => (
    <>
      <C x={50} y={50} r={34} fill />
      <P d="M28 30c8 4 10 10 6 16s4 10 10 8 8 6 4 12M60 20c-4 6 2 10 8 8s8 8 4 14-2 12 6 14M18 56c6-2 10 2 12 8" accent />
    </>
  ),
  moon: () => (
    <>
      <P d="M62 16a34 34 0 1 0 22 50A28 28 0 0 1 62 16z" fill accent />
      <C x={44} y={58} r={4} />
      <C x={56} y={74} r={3} />
    </>
  ),
  star: () => <P d="M50 12l10 26 28 2-22 18 8 28-24-16-24 16 8-28-22-18 28-2z" fill accent />,
  eye: () => (
    <>
      <P d="M8 50c12-20 28-28 42-28s30 8 42 28c-12 20-28 28-42 28S20 70 8 50z" />
      <C x={50} y={50} r={14} fill accent />
      <C x={50} y={50} r={5} fill />
    </>
  ),
  ear: () => (
    <>
      <P d="M64 78c-4 10-20 12-24 0-2-8 6-12 6-20 0-6-10-8-10-20a22 22 0 0 1 44 0c0 12-8 16-8 24s-4 10-8 16z" />
      <P d="M46 40a10 10 0 0 1 20 0c0 6-6 8-6 14" accent />
    </>
  ),
  cloud: () => <P d="M26 72a16 16 0 0 1 0-32 22 22 0 0 1 42-6 18 18 0 0 1 8 38z" fill />,
  drop: () => <P d="M50 12C40 30 26 44 26 60a24 24 0 0 0 48 0c0-16-14-30-24-48z" fill accent />,
  lightning: () => <P d="M58 8L26 56h20l-6 36 34-50H54z" fill accent />,
  speaker: () => (
    <>
      <P d="M16 38h16l20-16v56L32 62H16z" fill />
      <P d="M62 36c6 6 6 22 0 28M72 26c12 12 12 36 0 48" accent />
    </>
  ),
  headphones: () => (
    <>
      <P d="M18 62V50a32 32 0 0 1 64 0v12" />
      <R x={12} y={56} w={16} h={28} r={6} fill accent />
      <R x={72} y={56} w={16} h={28} r={6} fill accent />
    </>
  ),
  phone: () => (
    <>
      <R x={30} y={10} w={40} h={80} r={8} />
      <R x={36} y={20} w={28} h={56} r={3} fill accent />
      <C x={50} y={83} r={2.5} />
    </>
  ),
  router: () => (
    <>
      <R x={18} y={60} w={64} h={20} r={5} fill />
      <P d="M32 60V44M68 60V44" />
      <P d="M36 34a20 20 0 0 1 28 0M28 26a32 32 0 0 1 44 0" accent />
      <C x={30} y={70} r={2.5} accent fill />
    </>
  ),
  wall: () => (
    <>
      <R x={22} y={10} w={56} h={80} r={2} fill />
      <P d="M22 26h56M22 42h56M22 58h56M22 74h56M50 10v16M36 26v16M64 26v16M50 42v16M36 58v16M64 58v16M50 74v16" accent />
    </>
  ),
  ambulance: () => (
    <>
      <P d="M8 70V36h52v34M60 46h18l14 14v10H60" fill />
      <C x={26} y={72} r={8} fill />
      <C x={74} y={72} r={8} fill />
      <P d="M34 44v16M26 52h16" accent />
      <R x={40} y={26} w={10} h={10} r={2} fill accent />
    </>
  ),
  plane: () => (
    <>
      <P d="M10 54l30-6 26-30c4-4 10-2 8 4L60 48l26 4c4 1 4 7 0 8l-26 4 14 18c2 4-2 6-6 4L44 66l-30-2c-6 0-6-8 0-10z" fill />
      <P d="M44 58h20" accent />
    </>
  ),
  ship: () => (
    <>
      <P d="M10 60h80l-12 22H22z" fill />
      <R x={30} y={40} w={40} h={20} r={2} />
      <R x={42} y={24} w={12} h={16} r={2} fill accent />
      <P d="M6 90c8-4 14 4 22 0s14 4 22 0 14 4 22 0 14 4 22 0" accent />
    </>
  ),
  ball: () => (
    <>
      <C x={50} y={50} r={34} fill accent />
      <P d="M50 16c-14 14-14 54 0 68M16 50c14-10 54-10 68 0" />
    </>
  ),
  feather: () => (
    <>
      <P d="M76 14C46 18 26 44 24 80c20-6 46-26 52-66z" fill accent />
      <P d="M20 88L64 30M38 62h18M44 50h16" />
    </>
  ),
  hammer: () => (
    <>
      <R x={20} y={16} w={50} h={22} r={4} fill accent />
      <P d="M50 38v50" />
      <R x={44} y={60} w={12} h={30} r={3} fill />
    </>
  ),
  parachute: () => (
    <>
      <P d="M12 46a38 30 0 0 1 76 0c-6-4-12-4-19 0-6-4-13-4-19 0-6-4-13-4-19 0-7-4-13-4-19 0z" fill accent />
      <P d="M12 46l34 30M88 46L54 76M50 46v30" />
      <C x={50} y={80} r={5} fill />
      <P d="M50 85v8" />
    </>
  ),
  person: () => (
    <>
      <C x={50} y={20} r={10} fill />
      <P d="M50 30v32M30 44h40M50 62L36 88M50 62l14 26" />
    </>
  ),
  skater: () => (
    <>
      <C x={50} y={16} r={9} fill />
      <P d="M50 25v36M50 34l-22 10M50 34l22 10M50 61l-6 26M50 61l12 22" />
      <P d="M36 90h22M56 86h16" accent />
      <P d="M18 40c-6 10-6 22 2 30M82 40c6 10 6 22-2 30" accent />
    </>
  ),
  bird: () => (
    <>
      <P d="M20 56c6-16 22-22 36-18l14-8 10 4-8 6c4 14-4 30-24 30H24z" fill />
      <C x={66} y={40} r={2.5} fill accent />
      <P d="M80 34l10 2-10 4" accent />
      <P d="M40 72l-4 14M52 72l2 14" />
    </>
  ),
  satellite: () => (
    <>
      <R x={40} y={40} w={20} h={20} r={3} fill accent />
      <R x={6} y={42} w={28} h={16} r={1} />
      <R x={66} y={42} w={28} h={16} r={1} />
      <P d="M34 50h6M60 50h6M20 42v16M80 42v16M50 40V26" />
      <C x={50} y={22} r={4} />
    </>
  ),
  clock: () => (
    <>
      <C x={50} y={50} r={36} />
      <P d="M50 26v24l16 10" accent />
      <P d={rays(50, 50, 30, 34, 12)} />
    </>
  ),
  thermometer: () => (
    <>
      <P d="M42 62V18a8 8 0 0 1 16 0v44a16 16 0 1 1-16 0z" />
      <C x={50} y={74} r={9} fill accent />
      <P d="M50 66V30" accent />
      <P d="M62 26h8M62 38h8M62 50h8" />
    </>
  ),
  balloon: () => (
    <>
      <P d="M50 10c-18 0-28 14-28 28 0 18 18 32 28 34 10-2 28-16 28-34 0-14-10-28-28-28z" fill accent />
      <P d="M46 74h8l-4-4zM50 74c-6 8 6 10 0 20" />
    </>
  ),
  car: () => (
    <>
      <P d="M10 66V54l10-4 12-16h30l14 16 14 4v12z" fill />
      <P d="M36 38h24l8 12H30z" accent />
      <C x={28} y={68} r={9} fill />
      <C x={72} y={68} r={9} fill />
    </>
  ),
  straw: () => (
    <>
      <P d="M26 30h48l-6 60H32z" />
      <P d="M30 52h40l-3 36H33z" fill accent />
      <P d="M52 66L66 8h10" />
    </>
  ),
  ice: () => (
    <>
      <P d="M20 40l30-16 30 16v32L50 88 20 72z" fill accent />
      <P d="M20 40l30 16 30-16M50 56v32" />
      <P d="M30 46l8 4" />
    </>
  ),
  skate: () => (
    <>
      <P d="M22 20h22v34l26 6c6 2 8 6 8 10H22z" fill />
      <P d="M14 84h70c4 0 6-2 6-6" accent />
      <P d="M30 70v14M66 70v14" />
    </>
  ),
  flame: () => (
    <>
      <P d="M50 8c4 18 26 26 26 50a26 26 0 0 1-52 0c0-14 8-20 12-30 4 8 8 10 10 10 0-10 0-20 4-30z" fill accent />
      <P d="M50 88a12 12 0 0 1-12-12c0-8 8-12 12-20 4 8 12 12 12 20a12 12 0 0 1-12 12z" />
    </>
  ),
  battery: () => (
    <>
      <R x={14} y={30} w={64} h={40} r={6} />
      <R x={78} y={42} w={8} h={16} r={2} fill />
      <R x={20} y={36} w={30} h={28} r={3} fill accent />
    </>
  ),
  coil: () => (
    <>
      <P d="M10 50h12c0-14 12-14 12 0s12 14 12 0 12-14 12 0 12 14 12 0 12-14 12 0h6" accent />
      <P d="M10 70h80" />
    </>
  ),
  magnet: () => (
    <>
      <P d="M22 20v34a28 28 0 0 0 56 0V20H60v34a10 10 0 0 1-20 0V20z" fill />
      <R x={22} y={14} w={18} h={14} r={1} fill accent />
      <R x={60} y={14} w={18} h={14} r={1} fill accent />
    </>
  ),
  mirror: () => (
    <>
      <P d="M50 12c14 0 22 12 22 30s-8 30-22 30-22-12-22-30 8-30 22-30z" fill accent />
      <P d="M50 72v16M34 90h32" />
      <P d="M40 30l10-8M38 44l18-14" />
    </>
  ),
  hand: () => (
    <P d="M34 90V50l-8-10c-4-6 2-12 8-6l6 6V16c0-6 8-6 8 0v24-28c0-6 8-6 8 0v28-24c0-6 8-6 8 0v26-18c0-6 8-6 8 0v34c0 18-10 32-28 32z" fill />
  ),
  rocket: () => (
    <>
      <P d="M50 8c14 12 18 30 14 52H36C32 38 36 20 50 8z" fill />
      <C x={50} y={34} r={7} fill accent />
      <P d="M36 60l-10 14 14-2M64 60l10 14-14-2" />
      <P d="M44 66c-2 10 6 14 6 22 0-8 8-12 6-22" accent fill />
    </>
  ),
  house: () => (
    <>
      <P d="M14 46L50 16l36 30M22 40v46h56V40" fill />
      <R x={42} y={62} w={16} h={24} r={1} fill accent />
    </>
  ),
  wind: () => <P d="M10 40h52a10 10 0 1 0-10-10M10 56h66a10 10 0 1 1-10 10M10 72h30" accent />,
  box: () => (
    <>
      <R x={22} y={22} w={56} h={56} r={4} fill accent />
      <P d="M22 38h56M38 22v56" />
    </>
  ),
  atom: () => (
    <>
      <C x={50} y={50} r={7} fill accent />
      <P d="M50 14c10 0 14 16 14 36s-4 36-14 36-14-16-14-36 4-36 14-36z" />
      <P d="M18 32c6-8 22-2 40 8s28 22 24 28-22 2-40-8-28-22-24-28z" />
      <P d="M18 68c-4-8 8-18 26-28s34-14 38-6-8 18-26 28-34 14-38 6z" />
    </>
  ),
  door: () => (
    <>
      <R x={26} y={8} w={48} h={84} r={2} />
      <C x={64} y={52} r={5} fill accent />
      <P d="M58 52h-8" />
    </>
  ),
  wire: () => (
    <>
      <P d="M4 34c30 16 62 16 92 0" />
      <P d="M4 54c30 16 62 16 92 0" accent />
      <R x={4} y={20} w={4} h={60} r={1} fill />
      <R x={92} y={20} w={4} h={60} r={1} fill />
    </>
  ),
  snowflake: () => (
    <>
      <P d={rays(50, 50, 0, 38, 6)} accent />
      <P d="M50 22l-8-8M50 22l8-8M50 78l-8 8M50 78l8 8M26 36l-12-2M26 36l-4-10M74 64l12 2M74 64l4 10M74 36l12-2M74 36l4-10M26 64l-12 2M26 64l-4 10" />
    </>
  ),
  mountain: () => (
    <>
      <P d="M6 84l30-50 16 24 12-16 30 42z" fill />
      <P d="M28 48l8-14 8 12-8-2z" fill accent />
    </>
  ),
  question: () => (
    <>
      <P d="M32 34a18 18 0 1 1 26 16c-6 4-8 8-8 14" accent />
      <C x={50} y={80} r={4} fill accent />
    </>
  ),
  bulb: () => (
    <>
      <P d="M36 64c-8-6-14-14-14-26a28 28 0 0 1 56 0c0 12-6 20-14 26v8H36z" fill accent />
      <P d="M38 80h24M42 90h16" />
    </>
  ),
  rain: () => (
    <>
      <P d="M24 56a14 14 0 0 1 0-28 20 20 0 0 1 38-6 16 16 0 0 1 8 34z" fill />
      <P d="M30 66l-4 10M48 66l-4 10M66 66l-4 10M38 80l-4 10M56 80l-4 10" accent />
    </>
  ),
};

export const IconSvg: React.FC<{
  name: IconName;
  size: number;
  /** postup kreslení 0…1 */
  t?: number;
  accent: string;
  ink: string;
  strokeWidth?: number;
}> = ({name, size, t = 1, accent, ink, strokeWidth = 3.4}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible'}}>
    <DrawCtx.Provider value={{t: Math.max(0, Math.min(1, t)), a: accent, ink}}>
      <g strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {(ICON_DRAW[name] ?? ICON_DRAW.question)()}
      </g>
    </DrawCtx.Provider>
  </svg>
);

/** Ikona vložená do jiného SVG (souřadnice středu a velikost v jednotkách rodiče). */
export const IconG: React.FC<{name: IconName; x: number; y: number; size: number; t?: number; accent: string; ink: string; strokeWidth?: number}> = ({
  name,
  x,
  y,
  size,
  t = 1,
  accent,
  ink,
  strokeWidth = 3.4,
}) => (
  <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})`}>
    <DrawCtx.Provider value={{t: Math.max(0, Math.min(1, t)), a: accent, ink}}>
      <g strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {(ICON_DRAW[name] ?? ICON_DRAW.question)()}
      </g>
    </DrawCtx.Provider>
  </g>
);
