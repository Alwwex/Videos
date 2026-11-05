import React from 'react';
import {Easing, interpolate} from 'remotion';
import type {Lang} from '../../engine/schema';
import type {Visual} from '../schema';
import {BODY_FONT, MONO_FONT, type Theme} from '../theme';

/** Plocha diagramu uvnitř panelu (px). */
export const W = 900;
export const H = 760;

export type VProps<T extends Visual['type'] = Visual['type']> = {
  v: Extract<Visual, {type: T}>;
  /** snímek od začátku scény */
  f: number;
  /** délka scény ve snímcích */
  dur: number;
  fps: number;
  th: Theme;
  lang: Lang;
  /** barva zvýraznění scény */
  ac: string;
  nextTitle?: string | null;
  seriesTitle: string;
  followText: string;
  nextLabel: string;
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
/** 0→1 mezi snímky start a start+len, s náběhem/doběhem */
export const prog = (f: number, start: number, len: number, ease: (t: number) => number = Easing.inOut(Easing.cubic)) =>
  interpolate(f, [start, start + Math.max(1, len)], [0, 1], {...clamp, easing: ease});
export const out = (f: number, start: number, len: number) => prog(f, start, len, Easing.out(Easing.cubic));
export const pop = (f: number, start: number, len = 12) => prog(f, start, len, Easing.out(Easing.back(1.8)));

/** Malý technický popisek (mono, verzálky). */
export const Mono: React.FC<{children: React.ReactNode; color: string; size?: number; style?: React.CSSProperties}> = ({children, color, size = 24, style}) => (
  <div style={{fontFamily: MONO_FONT, fontWeight: 600, fontSize: size, letterSpacing: 2.5, textTransform: 'uppercase', color, ...style}}>{children}</div>
);

/** Popisek pod diagramem. */
export const Caption: React.FC<{text?: string | null; th: Theme; f: number; delay?: number; bottom?: number}> = ({text, th, f, delay = 14, bottom = 26}) =>
  text ? (
    <div
      style={{
        position: 'absolute',
        left: 30,
        right: 30,
        bottom,
        textAlign: 'center',
        fontFamily: BODY_FONT,
        fontWeight: 700,
        fontSize: 38,
        lineHeight: 1.2,
        color: th.muted,
        opacity: out(f, delay, 14),
        transform: `translateY(${(1 - out(f, delay, 14)) * 16}px)`,
      }}
    >
      {text}
    </div>
  ) : null;

/** Svítící tečka (záře + jádro). */
export const Dot: React.FC<{x: number; y: number; r?: number; color: string}> = ({x, y, r = 12, color}) => (
  <g>
    <circle cx={x} cy={y} r={r * 3.2} fill={color} opacity={0.14} />
    <circle cx={x} cy={y} r={r * 1.8} fill={color} opacity={0.28} />
    <circle cx={x} cy={y} r={r} fill={color} />
  </g>
);

/** Šipka (čára + hrot) z (x1,y1) do (x2,y2), t = postup kreslení. */
export const Arrow: React.FC<{x1: number; y1: number; x2: number; y2: number; color: string; t?: number; w?: number; head?: number; dashed?: boolean}> = ({
  x1,
  y1,
  x2,
  y2,
  color,
  t = 1,
  w = 8,
  head = 26,
  dashed,
}) => {
  if (t <= 0.001) return null;
  const xe = x1 + (x2 - x1) * t;
  const ye = y1 + (y2 - y1) * t;
  const a = Math.atan2(ye - y1, xe - x1);
  const len = Math.hypot(xe - x1, ye - y1);
  const h = Math.min(head, len * 0.6);
  const bx = xe - Math.cos(a) * h * 0.8;
  const by = ye - Math.sin(a) * h * 0.8;
  const p1 = [xe - Math.cos(a - 0.45) * h, ye - Math.sin(a - 0.45) * h];
  const p2 = [xe - Math.cos(a + 0.45) * h, ye - Math.sin(a + 0.45) * h];
  return (
    <g>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={dashed ? `${w * 2} ${w * 1.6}` : undefined} />
      <path d={`M${xe} ${ye}L${p1[0]} ${p1[1]}L${p2[0]} ${p2[1]}Z`} fill={color} stroke={color} strokeWidth={3} strokeLinejoin="round" />
    </g>
  );
};

/** Deterministický pseudonáhodný generátor (stejný výsledek při každém renderu). */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Odraz od stěn: pozice v intervalu [0, L] při rovnoměrném pohybu. */
export const bounce = (p: number, L: number) => {
  const m = ((p % (2 * L)) + 2 * L) % (2 * L);
  return m <= L ? m : 2 * L - m;
};

export const fmt = (n: number, decimals: number, lang: Lang) =>
  n.toLocaleString(lang === 'en' ? 'en-US' : lang === 'ro' ? 'ro-RO' : 'cs-CZ', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});

export const Abs: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{position: 'absolute', inset: 0, ...style}}>{children}</div>
);

export const Svg: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
    {children}
  </svg>
);
