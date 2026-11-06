import React from 'react';
import {Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as shantell} from '@remotion/google-fonts/ShantellSans';
import type {Lang} from '../engine/schema';
import type {Visual} from '../v2/schema';
import type {Theme as V2Theme} from '../v2/theme';
import {HEAD_FONT} from '../v2/theme';
import {Visual as VisualWidget} from '../v2/visuals';

export const HAND_FONT = shantell('normal', {weights: ['700', '800'], subsets: ['latin', 'latin-ext']}).fontFamily;

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});

/* ======================= TITULKY ======================= */

export type CapWord = {text: string; hl: boolean; start: number};
export type CapGroup = {words: CapWord[]; start: number};

/** Slova → skupiny po 1–3 slovech (max ~16 znaků), konec věty skupinu ukončí. */
export const groupWords = (words: CapWord[]): CapGroup[] => {
  const out: CapGroup[] = [];
  let cur: CapWord[] = [];
  const flush = () => {
    if (cur.length) out.push({words: cur, start: cur[0].start});
    cur = [];
  };
  words.forEach((w, i) => {
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (cur.length && (cur.length >= 3 || chars > 16)) flush();
    cur.push(w);
    const left = words.length - i - 1;
    if (/[.!?…:;]$/.test(w.text) && left !== 1) flush();
    else if (/,$/.test(w.text) && cur.length >= 2 && left > 1) flush();
  });
  flush();
  // osamocené slovo na konci přilep k předchozí skupině
  if (out.length > 1 && out[out.length - 1].words.length === 1 && out[out.length - 2].words.length < 3) {
    const last = out.pop()!;
    out[out.length - 1].words.push(...last.words);
  }
  return out;
};

/** Velké titulky uprostřed obrazu: aktuální slovo poskočí, klíčová slova svítí barvou. */
export const Captions: React.FC<{groups: CapGroup[]; accent: string; top?: number}> = ({groups, accent, top = 1330}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!groups.length) return null;
  let gi = -1;
  groups.forEach((g, i) => {
    if (f >= g.start - 1) gi = i;
  });
  if (gi < 0) return null;
  const g = groups[gi];
  const len = g.words.reduce((n, w) => n + w.text.length + 1, 0);
  const hasHl = g.words.some((w) => w.hl);
  const size = (len > 15 ? 74 : len > 11 ? 84 : 94) * (hasHl && len > 12 ? 0.9 : 1);
  const pop = spring({frame: f - g.start + 1, fps, config: {damping: 12, stiffness: 320, mass: 0.5}});
  let wi = 0;
  g.words.forEach((w, i) => {
    if (f >= w.start - 1) wi = i;
  });
  return (
    <div style={{position: 'absolute', left: 30, right: 30, top, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', columnGap: size * 0.62, rowGap: 0, transform: `scale(${0.82 + 0.18 * pop})`}}>
      {g.words.map((w, i) => {
        const active = i === wi;
        const said = f >= w.start - 1;
        // klíčové slovo: větší, barevné, "dopadne" s překmitem a krátce se zatřese
        const hit = spring({frame: f - w.start + 1, fps, config: {damping: 7, stiffness: 420, mass: 0.5}});
        const shake = w.hl && said && f - w.start < 8 ? Math.sin((f - w.start) * 2.6) * (8 - (f - w.start)) * 0.9 : 0;
        const fs = w.hl ? size * 1.3 : size;
        const sc = w.hl ? (said ? 0.6 + 0.4 * hit : 0.85) : active ? 1.03 : 1;
        return (
          <span
            key={`${gi}-${i}`}
            style={{
              display: 'inline-block',
              fontFamily: HEAD_FONT,
              fontWeight: 900,
              fontSize: fs,
              lineHeight: 1.08,
              textTransform: 'uppercase',
              color: w.hl ? accent : '#FFFFFF',
              WebkitTextStroke: `${Math.round(fs * 0.15)}px #14100c`,
              paintOrder: 'stroke fill',
              textShadow: w.hl ? `0 9px 0 rgba(20,16,12,0.6), 0 0 34px ${accent}66` : '0 8px 0 rgba(20,16,12,0.55)',
              transform: `translate(${shake}px, ${-Math.abs(shake) * 0.4}px) scale(${sc}) rotate(${w.hl ? (i % 2 ? 3 : -3) : active ? (i % 2 ? 1.5 : -1.5) : 0}deg)`,
              opacity: said ? 1 : 0.5,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

/* ======================= HÁČEK ======================= */

/** Úvodní háček: obří text, slova dopadnou jedno po druhém, pod ním ručně načmáraná čára. */
export const Hook: React.FC<{text: string; accent: string; dur: number}> = ({text, accent, dur}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  // jednotky (°C, %, km/h…) drží u čísla
  const words = text
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .reduce<string[]>((acc, w) => {
      if (acc.length && /^(°|%|KM|M\/S|KG|W$|V$|G$)/.test(w) && /\d$/.test(acc[acc.length - 1])) acc[acc.length - 1] += `\u00a0${w}`;
      else acc.push(w);
      return acc;
    }, []);
  // zalomení do řádků po ~13 znacích
  const lines: string[][] = [[]];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    const l = cur.join(' ').length;
    if (cur.length && l + w.length + 1 > 13) lines.push([w]);
    else cur.push(w);
  }
  const longest = Math.max(...lines.map((l) => l.join(' ').length), 1);
  const size = Math.min(132, Math.floor(1460 / longest));
  const out = interpolate(f, [dur - 6, dur], [1, 0], clamp);
  const shake = f < 9 ? Math.sin(f * 2.7) * (9 - f) * 2.2 : 0;
  let k = 0;
  const underline = ease(f, 8 + words.length * 3, 20 + words.length * 3);
  return (
    <div style={{position: 'absolute', left: 30, right: 30, top: 250, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: out, transform: `translate(${shake}px, ${shake * 0.5}px)`}}>
      {lines.map((line, li) => (
        <div key={li} style={{display: 'flex', columnGap: size * 0.42, justifyContent: 'center'}}>
          {line.map((w) => {
            const i = k++;
            const s = spring({frame: f - i * 3, fps, config: {damping: 11, stiffness: 300, mass: 0.6}});
            const last = li === lines.length - 1;
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  fontFamily: HEAD_FONT,
                  fontWeight: 900,
                  fontSize: size,
                  lineHeight: 1.02,
                  color: last ? accent : '#FFFFFF',
                  WebkitTextStroke: `${Math.round(size * 0.14)}px #14100c`,
                  paintOrder: 'stroke fill',
                  textShadow: '0 12px 0 rgba(20,16,12,0.5)',
                  transform: `scale(${2 - s}) rotate(${(1 - s) * (i % 2 ? 9 : -9)}deg)`,
                  opacity: Math.min(1, s * 2),
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      ))}
      <svg width={760} height={60} viewBox="0 0 760 60" style={{marginTop: 4, overflow: 'visible'}}>
        <defs>
          <filter id="hookWob">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed={Math.floor(f / 4) % 3} />
            <feDisplacementMap in="SourceGraphic" scale="6" />
          </filter>
        </defs>
        <path
          d="M30 34 C 200 18, 420 44, 730 22"
          stroke={accent}
          strokeWidth={13}
          strokeLinecap="round"
          fill="none"
          filter="url(#hookWob)"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - underline}
        />
      </svg>
    </div>
  );
};

/* ======================= RUČNĚ KRESLENÉ POPISKY ======================= */

export type NotePos = {anchor: {x: number; y: number}; label: {x: number; y: number}; text: string; delay: number};

/** Ručně kreslená šipka s popiskem (fix na obrazovce). Čára se "kreslí", lehce se chvěje jako animovaná ručně. */
export const Note: React.FC<{n: NotePos; color: string; index: number}> = ({n, color, index}) => {
  const f = useCurrentFrame();
  const t = ease(f, n.delay, n.delay + 9);
  const lp = spring({frame: f - n.delay - 4, fps: 30, config: {damping: 9, stiffness: 220, mass: 0.5}});
  if (f < n.delay) return null;
  const {anchor: a, label: l} = n;
  // čára začíná u okraje popisku směrem k předmětu
  const dx = a.x - l.x;
  const dy = a.y - l.y;
  const dist = Math.hypot(dx, dy) || 1;
  const sx = l.x + (dx / dist) * Math.min(150, dist * 0.3);
  const sy = l.y + (dy / dist) * 60;
  const ex = a.x - (dx / dist) * 34;
  const ey = a.y - (dy / dist) * 34;
  const side = index % 2 ? 1 : -1;
  const cx = (sx + ex) / 2 + (-dy / dist) * 70 * side;
  const cy = (sy + ey) / 2 + (dx / dist) * 70 * side;
  const ang = Math.atan2(ey - cy, ex - cx);
  const hl = 34;
  const h1 = [ex - Math.cos(ang - 0.5) * hl, ey - Math.sin(ang - 0.5) * hl];
  const h2 = [ex - Math.cos(ang + 0.5) * hl, ey - Math.sin(ang + 0.5) * hl];
  const seed = Math.floor(f / 4) % 3;
  const head = ease(f, n.delay + 7, n.delay + 11);
  return (
    <>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <defs>
          <filter id={`wob${index}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed={seed + index * 7} />
            <feDisplacementMap in="SourceGraphic" scale="7" />
          </filter>
        </defs>
        <g filter={`url(#wob${index})`} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={`M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`} stroke="#14100c" strokeWidth={17} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} opacity={0.55} />
          <path d={`M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`} stroke={color} strokeWidth={9} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
          <path d={`M${h1[0]} ${h1[1]} L${ex} ${ey} L${h2[0]} ${h2[1]}`} stroke="#14100c" strokeWidth={17} opacity={0.55 * head} />
          <path d={`M${h1[0]} ${h1[1]} L${ex} ${ey} L${h2[0]} ${h2[1]}`} stroke={color} strokeWidth={9} opacity={head} />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: l.x - 230,
          top: l.y - 50,
          width: 460,
          textAlign: 'center',
          fontFamily: HAND_FONT,
          fontWeight: 800,
          fontSize: 64,
          lineHeight: 1.0,
          color,
          WebkitTextStroke: '12px #14100c',
          paintOrder: 'stroke fill',
          transform: `scale(${lp}) rotate(${index % 2 ? 3 : -4}deg)`,
          opacity: Math.min(1, lp * 1.5),
        }}
      >
        {n.text}
      </div>
    </>
  );
};

/** Rozmístí popisky kolem předmětů: mimo titulky a kartu, navzájem se nepřekrývají. */
export const placeNotes = (anchors: {x: number; y: number}[], minY: number, maxY = 1180): {x: number; y: number}[] => {
  const placed: {x: number; y: number}[] = [];
  anchors.forEach((a, i) => {
    let x = a.x < 540 ? a.x + 250 : a.x - 250;
    if (i === 1 && placed[0] && Math.abs(placed[0].x - x) < 300) x = placed[0].x < 540 ? 790 : 290;
    x = Math.max(250, Math.min(830, x));
    let y = a.y - 260;
    if (y < minY) y = a.y + 230;
    y = Math.max(minY, Math.min(maxY, y));
    for (const p of placed) if (Math.abs(p.x - x) < 420 && Math.abs(p.y - y) < 130) y = p.y + (p.y + 140 <= maxY ? 140 : -140);
    placed.push({x, y: Math.max(minY, Math.min(maxY, y))});
  });
  return placed;
};

/* ======================= INFO KARTA ======================= */

const GLASS: V2Theme = {
  name: 'glass',
  bg: 'transparent',
  grid: 'rgba(255,255,255,0.05)',
  ink: '#FFFFFF',
  muted: '#C9D3EA',
  panel: 'transparent',
  panelBorder: 'rgba(255,255,255,0.28)',
  line: '#F2F5FF',
  accents: {yellow: '#FFD43B', teal: '#4FE3C1', red: '#FF6B6B', blue: '#7CC4FF'},
  dark: true,
};

/** Karta "přilepená páskou" nahoře: uvnitř graf / číslo / vzorec z 2D knihovny. */
export const InfoCard: React.FC<{v: Visual; dur: number; lang: Lang; accent: string}> = ({v, dur, lang, accent}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const d = 3;
  const inn = spring({frame: f - d, fps, config: {damping: 13, stiffness: 200, mass: 0.6}});
  const out = interpolate(f, [dur - 5, dur], [1, 0], clamp);
  const scale = 0.8;
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        top: 140,
        width: 960,
        height: 620,
        opacity: Math.min(1, inn * 1.4) * out,
        transform: `translateY(${(1 - inn) * -60}px) rotate(${(1 - inn) * -3 - 0.6}deg)`,
      }}
    >
      <div style={{position: 'absolute', inset: 0, borderRadius: 34, background: 'rgba(14,16,30,0.78)', border: '3px solid rgba(255,255,255,0.22)', boxShadow: '0 24px 60px rgba(0,0,0,0.35)'}} />
      {/* kousky pásky v rozích – jako přilepené ručně */}
      <div style={{position: 'absolute', left: -18, top: -16, width: 150, height: 46, background: 'rgba(255,236,170,0.78)', transform: 'rotate(-14deg)', borderRadius: 4}} />
      <div style={{position: 'absolute', right: -18, top: -14, width: 150, height: 46, background: 'rgba(255,236,170,0.78)', transform: 'rotate(11deg)', borderRadius: 4}} />
      <div style={{position: 'absolute', left: (960 - 900 * scale) / 2, top: (620 - 760 * scale) / 2 + 4, width: 900, height: 760, transform: `scale(${scale})`, transformOrigin: 'top left'}}>
        <VisualWidget
          v={v}
          f={Math.max(0, f - d)}
          dur={dur}
          fps={fps}
          th={GLASS}
          lang={lang}
          ac={accent}
          nextTitle={null}
          seriesTitle=""
          followText=""
          nextLabel=""
        />
      </div>
    </div>
  );
};


/* ======================= ZÁVĚREČNÁ KARTA „SLEDUJ“ ======================= */

const END: Record<Lang, {big: string; sub: string; btn: string; done: string; next: string}> = {
  cs: {big: 'SLEDUJ', sub: 'ať ti neuteče další díl', btn: 'Sledovat', done: 'Sleduješ', next: 'příště'},
  en: {big: 'FOLLOW', sub: "so you don't miss the next one", btn: 'Follow', done: 'Following', next: 'next up'},
  ro: {big: 'URMĂREȘTE', sub: 'ca să nu ratezi următorul', btn: 'Urmărește', done: 'Urmărești', next: 'urmează'},
};

/** Konec videa: profilovka, velké SLEDUJ, tlačítko, které se samo "ťukne", a upoutávka na další díl. */
export const EndCard: React.FC<{lang: Lang; accent: string; dur: number; nextTitle?: string | null; avatar: string; tapAt: number}> = ({lang, accent, dur, nextTitle, avatar, tapAt}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const L = END[lang];
  const sp = (d: number, damping = 11) => spring({frame: f - d, fps, config: {damping, stiffness: 230, mass: 0.6}});
  const av = sp(1, 9);
  const big = sp(5);
  const sub = sp(9);
  const btn = sp(12);
  const nx = sp(16);
  const tapped = f >= tapAt;
  const press = Math.max(0, 1 - Math.abs(f - tapAt) / 4);
  const out = interpolate(f, [dur - 4, dur], [1, 0], clamp);
  const arrow = ease(f, tapAt - 14, tapAt - 2);
  const seed = Math.floor(f / 4) % 3;
  const ring = 1 + Math.max(0, Math.sin(f * 0.18)) * 0.04;
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 330, opacity: out}}>
      <div style={{width: 300, height: 300, borderRadius: '50%', padding: 10, background: `conic-gradient(${accent}, #ff5fb0, #4fd8ff, ${accent})`, transform: `scale(${av * ring}) rotate(${(1 - av) * -20}deg)`, boxShadow: `0 0 60px ${accent}66`}}>
        <Img src={avatar} style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '6px solid #14100c'}} />
      </div>
      <div
        style={{
          marginTop: 34,
          fontFamily: HEAD_FONT,
          fontWeight: 900,
          fontSize: L.big.length > 7 ? 112 : 140,
          lineHeight: 1,
          color: '#FFFFFF',
          WebkitTextStroke: '18px #14100c',
          paintOrder: 'stroke fill',
          textShadow: '0 12px 0 rgba(20,16,12,0.5)',
          transform: `scale(${2 - big}) rotate(${(1 - big) * 8 - 2}deg)`,
          opacity: Math.min(1, big * 2),
        }}
      >
        {L.big}
      </div>
      <div style={{marginTop: 12, fontFamily: HAND_FONT, fontWeight: 800, fontSize: 60, color: accent, WebkitTextStroke: '11px #14100c', paintOrder: 'stroke fill', transform: `scale(${sub}) rotate(-3deg)`, textAlign: 'center', maxWidth: 900}}>
        {L.sub}
      </div>
      <div style={{position: 'relative', marginTop: 44}}>
        <div
          style={{
            padding: '26px 64px',
            borderRadius: 999,
            background: tapped ? '#2fcf7a' : '#ff3b5c',
            color: '#FFFFFF',
            fontFamily: HEAD_FONT,
            fontWeight: 900,
            fontSize: 62,
            boxShadow: `0 14px 0 rgba(20,16,12,0.45), 0 0 50px ${tapped ? '#2fcf7a' : '#ff3b5c'}88`,
            transform: `scale(${btn * (1 - press * 0.12) + (tapped ? Math.max(0, 1 - (f - tapAt) / 10) * 0.12 : 0)})`,
            whiteSpace: 'nowrap',
          }}
        >
          {tapped ? '✓ ' : '+ '}
          {tapped ? L.done : L.btn}
        </div>
        {/* ručně nakreslená šipka, která na tlačítko "ukáže" */}
        <svg width={260} height={220} style={{position: 'absolute', right: -210, top: -150, overflow: 'visible'}}>
          <defs>
            <filter id="endWob">
              <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed={seed} />
              <feDisplacementMap in="SourceGraphic" scale="6" />
            </filter>
          </defs>
          <g filter="url(#endWob)" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M210 20 C 230 110, 150 170, 40 170" stroke="#14100c" strokeWidth={18} opacity={0.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - arrow} />
            <path d="M210 20 C 230 110, 150 170, 40 170" stroke="#FFFFFF" strokeWidth={10} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - arrow} />
            <path d="M74 140 L40 170 L80 196" stroke="#FFFFFF" strokeWidth={10} opacity={arrow > 0.9 ? 1 : 0} />
          </g>
        </svg>
      </div>
      {nextTitle ? (
        <div style={{marginTop: 56, textAlign: 'center', transform: `translateY(${(1 - nx) * 40}px)`, opacity: Math.min(1, nx * 1.5), maxWidth: 940}}>
          <span style={{fontFamily: HAND_FONT, fontWeight: 800, fontSize: 48, color: '#FFFFFF', WebkitTextStroke: '9px #14100c', paintOrder: 'stroke fill'}}>{L.next}: </span>
          <span style={{fontFamily: HEAD_FONT, fontWeight: 900, fontSize: 52, color: accent, WebkitTextStroke: '10px #14100c', paintOrder: 'stroke fill'}}>{nextTitle}</span>
        </div>
      ) : null}
    </div>
  );
};
