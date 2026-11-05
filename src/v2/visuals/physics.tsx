import React from 'react';
import {Easing, interpolate} from 'remotion';
import {IconG} from '../Icons';
import {MONO_FONT} from '../theme';
import {Abs, Arrow, Caption, Dot, H, Svg, W, bounce, out, pop, prog, rand, type VProps} from './common';

const DIRS: Record<string, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  upLeft: [-0.707, -0.707],
  upRight: [0.707, -0.707],
  downLeft: [-0.707, 0.707],
  downRight: [0.707, 0.707],
};

/* ---------------- forces (silový diagram) ---------------- */
export const ForcesV: React.FC<VProps<'forces'>> = ({v, f, dur, th, lang}) => {
  const m = prog(f, 0, dur, Easing.inOut(Easing.sin));
  const mv = {none: [0, 0], up: [0, -60], down: [0, 60], left: [-70, 0], right: [70, 0], shake: [Math.sin(f * 1.2) * 6, 0]}[v.motion] ?? [0, 0];
  const cx = 450 + (v.motion === 'shake' ? mv[0] : mv[0] * m);
  const cy = 370 + (v.motion === 'shake' ? 0 : mv[1] * m);
  const bodyR = 120;
  return (
    <Abs>
      <Svg>
        {/* mřížka v pozadí */}
        <g opacity={0.25}>
          <line x1={0} y1={370} x2={W} y2={370} stroke={th.muted} strokeWidth={2} strokeDasharray="6 10" />
          <line x1={450} y1={0} x2={450} y2={H} stroke={th.muted} strokeWidth={2} strokeDasharray="6 10" />
        </g>
        {v.motion !== 'none' && v.motion !== 'shake' ? (
          <g opacity={0.35 * m}>
            {[0.3, 0.6].map((k) => (
              <circle key={k} cx={450 + mv[0] * m * k} cy={370 + mv[1] * m * k} r={bodyR * 0.8} fill="none" stroke={th.muted} strokeWidth={3} strokeDasharray="8 8" />
            ))}
          </g>
        ) : null}
        <IconG name={v.body} x={cx} y={cy} size={230} t={out(f, 0, 18)} accent={th.accents.yellow} ink={th.line} strokeWidth={4} />
        {v.arrows.map((a, i) => {
          const [dx, dy] = DIRS[a.dir] ?? [0, -1];
          const len = 70 + Math.max(0.5, Math.min(3, a.size)) * 70;
          const t = out(f, 8 + i * 7, 14);
          const color = th.accents[a.color];
          return (
            <Arrow key={i} x1={cx + dx * bodyR} y1={cy + dy * bodyR} x2={cx + dx * (bodyR + len)} y2={cy + dy * (bodyR + len)} color={color} t={t} w={12} head={34} />
          );
        })}
      </Svg>
      {v.arrows.map((a, i) => {
        const [dx, dy] = DIRS[a.dir] ?? [0, -1];
        const len = 70 + Math.max(0.5, Math.min(3, a.size)) * 70;
        const x = cx + dx * (bodyR + len + 50);
        const y = cy + dy * (bodyR + len + 40);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: Math.max(0, Math.min(W - 300, x - 150)),
              top: Math.max(0, Math.min(H - 60, y - 26)),
              width: 300,
              textAlign: 'center',
              fontFamily: MONO_FONT,
              fontWeight: 600,
              fontSize: 30,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: th.accents[a.color],
              opacity: out(f, 14 + i * 7, 10),
              textShadow: th.dark ? '0 2px 12px #000a' : 'none',
            }}
          >
            {a.label[lang]}
          </div>
        );
      })}
    </Abs>
  );
};

/* ---------------- wave ---------------- */
export const WaveV: React.FC<VProps<'wave'>> = ({v, f, th, lang, ac}) => {
  const draw = out(f, 0, 18);
  const sine = (y0: number, amp: number, k: number, phase: number, x0 = 40, x1 = 860, ampAt?: (x: number) => number) => {
    let d = '';
    const xe = x0 + (x1 - x0) * draw;
    for (let x = x0; x <= xe; x += 6) {
      const A = ampAt ? ampAt(x) : amp;
      d += `${x === x0 ? 'M' : 'L'}${x} ${y0 + Math.sin(x * k - phase) * A}`;
    }
    return d;
  };
  const ph = f * 0.22;
  let body: React.ReactNode = null;
  if (v.mode === 'single') {
    body = (
      <>
        <line x1={40} y1={380} x2={860} y2={380} stroke={th.muted} strokeWidth={2} opacity={0.35} />
        <path d={sine(380, 150, 0.022, ph)} stroke={ac} strokeWidth={9} fill="none" strokeLinecap="round" />
      </>
    );
  } else if (v.mode === 'compare') {
    body = (
      <>
        <path d={sine(220, 110, 0.012, ph * 0.6)} stroke={th.accents.red} strokeWidth={8} fill="none" strokeLinecap="round" />
        <path d={sine(540, 110, 0.04, ph * 1.6)} stroke={th.accents.blue} strokeWidth={8} fill="none" strokeLinecap="round" />
        <line x1={40} y1={380} x2={860} y2={380} stroke={th.muted} strokeWidth={2} strokeDasharray="8 10" opacity={0.4} />
      </>
    );
  } else if (v.mode === 'cancel') {
    const merge = prog(f, 24, 26);
    body = (
      <>
        <path d={sine(170 + merge * 110, 90, 0.03, ph)} stroke={th.line} strokeWidth={7} fill="none" opacity={1 - merge * 0.6} />
        <path d={sine(390 - merge * 110, 90, 0.03, ph + Math.PI)} stroke={ac} strokeWidth={7} fill="none" opacity={1 - merge * 0.6} />
        <line x1={40} y1={600} x2={40 + 820 * merge} y2={600} stroke={th.accents.teal} strokeWidth={10} strokeLinecap="round" />
        <text x={450} y={680} textAnchor="middle" fill={th.accents.teal} fontFamily={MONO_FONT} fontWeight={600} fontSize={40} opacity={merge}>
          = 0
        </text>
      </>
    );
  } else if (v.mode === 'doppler') {
    const sx = 260 + f * 2.2;
    const fronts = Array.from({length: 9}, (_, i) => {
      const born = i * 9;
      if (f < born) return null;
      const r = (f - born) * 7;
      const x = 260 + born * 2.2;
      return <circle key={i} cx={x} cy={380} r={r} fill="none" stroke={ac} strokeWidth={5} opacity={Math.max(0, 1 - r / 520)} />;
    });
    body = (
      <>
        {fronts}
        <IconG name="ambulance" x={sx} y={380} size={150} accent={th.accents.red} ink={th.line} strokeWidth={4} />
        <IconG name="ear" x={800} y={380} size={110} accent={ac} ink={th.line} strokeWidth={4} />
        <IconG name="ear" x={90} y={380} size={110} accent={th.muted} ink={th.line} strokeWidth={4} />
      </>
    );
  } else if (v.mode === 'blocked') {
    body = (
      <>
        <IconG name="router" x={90} y={380} size={140} accent={ac} ink={th.line} strokeWidth={4} />
        <path d={sine(380, 120, 0.035, ph, 170, 860, (x) => (x < 470 ? 120 : 28))} stroke={ac} strokeWidth={7} fill="none" />
        <rect x={440} y={150} width={60} height={460} fill={th.muted} opacity={0.35} />
        <g stroke={th.line} strokeWidth={2} opacity={0.5}>
          {Array.from({length: 12}, (_, i) => (
            <line key={i} x1={440} y1={150 + i * 40} x2={500} y2={150 + i * 40} />
          ))}
        </g>
      </>
    );
  }
  return (
    <Abs>
      <Svg>{body}</Svg>
      <Caption text={v.label?.[lang]} th={th} f={f} />
    </Abs>
  );
};

/* ---------------- particles ---------------- */
export const ParticlesV: React.FC<VProps<'particles'>> = ({v, f, th, lang, ac}) => {
  const hot = th.accents.red;
  const cold = th.accents.blue;
  const box = (x: number, y: number, w: number, h: number, key: string) => (
    <rect key={key} x={x} y={y} width={w} height={h} rx={18} fill="none" stroke={th.line} strokeWidth={5} opacity={out(f, 0, 12)} />
  );
  const gas = (n: number, x: number, y: number, w: number, h: number, speed: number, color: string, seed: number, r = 13) =>
    Array.from({length: n}, (_, i) => {
      const a = rand(seed + i) * Math.PI * 2;
      const px = bounce(rand(seed + i * 3) * w + Math.cos(a) * speed * f, w - 2 * r) + r;
      const py = bounce(rand(seed + i * 7) * h + Math.sin(a) * speed * f, h - 2 * r) + r;
      return <circle key={`${seed}-${i}`} cx={x + px} cy={y + py} r={r} fill={color} opacity={pop(f, i * 0.6, 10)} />;
    });
  let body: React.ReactNode = null;
  if (v.mode === 'solid' || v.mode === 'liquid') {
    const solid = v.mode === 'solid';
    const items = [];
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 9; c++) {
        const i = r * 9 + c;
        const j = solid ? 3 : 14;
        const dx = Math.sin(f * (solid ? 0.6 : 0.12) + i * 1.7) * j + (solid ? 0 : Math.sin(f * 0.03 + i) * 18);
        const dy = Math.cos(f * (solid ? 0.7 : 0.1) + i * 2.3) * j;
        items.push(<circle key={i} cx={190 + c * 65 + dx + (r % 2 ? 32 : 0)} cy={170 + r * 65 + dy} r={22} fill={solid ? cold : ac} opacity={pop(f, i * 0.3, 10)} />);
      }
    body = (
      <>
        {box(140, 120, 620, 520, 'b')}
        {items}
      </>
    );
  } else if (v.mode === 'gas') {
    body = (
      <>
        {box(100, 90, 700, 580, 'b')}
        {gas(26, 100, 90, 700, 580, 7, ac, 3)}
      </>
    );
  } else if (v.mode === 'hotcold') {
    body = (
      <>
        {box(40, 130, 390, 500, 'c')}
        {box(470, 130, 390, 500, 'h')}
        {gas(14, 40, 130, 390, 500, 1.6, cold, 11)}
        {gas(14, 470, 130, 390, 500, 8.5, hot, 23)}
        <text x={235} y={100} textAnchor="middle" fill={cold} fontFamily={MONO_FONT} fontWeight={600} fontSize={34}>
          ❄
        </text>
        <text x={665} y={100} textAnchor="middle" fill={hot} fontFamily={MONO_FONT} fontWeight={600} fontSize={34}>
          🔥
        </text>
      </>
    );
  } else if (v.mode === 'rise') {
    // teplé částice stoupají, studené klesají (proudění)
    body = (
      <>
        {box(100, 60, 700, 640, 'b')}
        <rect x={300} y={660} width={300} height={30} rx={8} fill={hot} opacity={0.6 + Math.sin(f * 0.3) * 0.2} />
        {Array.from({length: 24}, (_, i) => {
          const warm = i % 2 === 0;
          const phase = (rand(i + 5) + f * (warm ? 0.012 : 0.008)) % 1;
          const y = warm ? 660 - phase * 580 : 90 + phase * 560;
          const x = 140 + rand(i * 9) * 620 + Math.sin(f * 0.08 + i) * 16;
          const r = warm ? 13 + phase * 5 : 13;
          return <circle key={i} cx={x} cy={y} r={r} fill={warm ? hot : cold} opacity={pop(f, i * 0.6, 10) * 0.95} />;
        })}
        <Arrow x1={450} y1={560} x2={450} y2={200} color={hot} t={out(f, 10, 20)} w={10} head={30} />
      </>
    );
  } else if (v.mode === 'pressure') {
    const flash = (i: number) => Math.max(0, 1 - (((f + i * 13) % 26) / 8));
    body = (
      <>
        {box(80, 120, 620, 520, 'b')}
        {gas(22, 80, 120, 620, 520, 9, ac, 41)}
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <circle cx={700} cy={190 + i * 125} r={26} fill={ac} opacity={flash(i) * 0.5} />
            <Arrow x1={712} y1={190 + i * 125} x2={850} y2={190 + i * 125} color={th.accents.red} t={out(f, 12 + i * 4, 12)} w={9} head={26} />
          </g>
        ))}
      </>
    );
  } else if (v.mode === 'evaporate') {
    body = (
      <>
        <rect x={120} y={420} width={660} height={240} rx={16} fill={cold} opacity={0.18} />
        <line x1={120} y1={420} x2={780} y2={420} stroke={cold} strokeWidth={5} />
        {gas(18, 120, 420, 660, 240, 2.2, cold, 61)}
        {Array.from({length: 7}, (_, i) => {
          const start = i * 14;
          const t = Math.max(0, (f - start) / 50);
          if (t <= 0 || t > 1.2) return null;
          const x = 180 + rand(i * 13) * 540 + Math.sin(t * 6 + i) * 20;
          return <circle key={i} cx={x} cy={440 - t * 420} r={14} fill={hot} opacity={Math.max(0, 1 - t)} />;
        })}
      </>
    );
  }
  return (
    <Abs>
      <Svg>{body}</Svg>
      <Caption text={v.label?.[lang]} th={th} f={f} bottom={4} />
    </Abs>
  );
};

/* ---------------- orbit ---------------- */
export const OrbitV: React.FC<VProps<'orbit'>> = ({v, f, th, lang, ac}) => {
  const cx = 450;
  const cy = 360;
  let body: React.ReactNode = null;
  if (v.mode === 'orbit' || v.mode === 'tilt') {
    const rx = 330;
    const ry = v.mode === 'tilt' ? 140 : 250;
    const a = -Math.PI / 2 + f * 0.035;
    const bx = cx + Math.cos(a) * rx;
    const by = cy + Math.sin(a) * ry;
    const vx = -Math.sin(a) * rx;
    const vy = Math.cos(a) * ry;
    const vl = Math.hypot(vx, vy);
    body = (
      <>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={th.muted} strokeWidth={3} strokeDasharray="10 12" opacity={out(f, 0, 14) * 0.6} />
        <IconG name={v.center} x={cx} y={cy} size={v.mode === 'tilt' ? 170 : 200} t={out(f, 0, 16)} accent={th.accents.yellow} ink={th.line} strokeWidth={4} />
        {v.mode === 'tilt' ? (
          <line x1={bx - 26} y1={by - 78} x2={bx + 26} y2={by + 78} stroke={ac} strokeWidth={6} strokeLinecap="round" />
        ) : null}
        <IconG name={v.body} x={bx} y={by} size={110} t={out(f, 4, 16)} accent={ac} ink={th.line} strokeWidth={5} />
        {v.mode === 'orbit' ? (
          <>
            <Arrow x1={bx} y1={by} x2={bx + (vx / vl) * 170} y2={by + (vy / vl) * 170} color={ac} t={out(f, 12, 12)} w={9} head={28} />
            <Arrow x1={bx} y1={by} x2={bx + (cx - bx) * 0.38} y2={by + (cy - by) * 0.38} color={th.accents.red} t={out(f, 18, 12)} w={9} head={28} />
          </>
        ) : null}
      </>
    );
  } else if (v.mode === 'tides') {
    const a = -0.4 + f * 0.012;
    const mx = cx + Math.cos(a) * 340;
    const my = cy + Math.sin(a) * 240;
    const deg = (a * 180) / Math.PI;
    const bulge = out(f, 6, 24);
    body = (
      <>
        <ellipse cx={cx} cy={cy} rx={150 + 55 * bulge} ry={150 - 10 * bulge} transform={`rotate(${deg} ${cx} ${cy})`} fill={ac} opacity={0.28} stroke={ac} strokeWidth={4} />
        <IconG name={v.center} x={cx} y={cy} size={260} t={out(f, 0, 16)} accent={th.accents.teal} ink={th.line} strokeWidth={4} />
        <IconG name={v.body} x={mx} y={my} size={110} t={out(f, 4, 16)} accent={th.accents.yellow} ink={th.line} strokeWidth={5} />
        <Arrow x1={mx - Math.cos(a) * 70} y1={my - Math.sin(a) * 70} x2={cx + Math.cos(a) * 230} y2={cy + Math.sin(a) * 230} color={th.accents.red} t={out(f, 14, 14)} w={7} head={24} dashed />
      </>
    );
  } else {
    // spin – Země se točí, bod na povrchu letí
    const a = f * 0.05;
    body = (
      <>
        <g transform={`rotate(${(a * 180) / Math.PI} ${cx} ${cy})`}>
          <IconG name={v.center} x={cx} y={cy} size={360} t={out(f, 0, 16)} accent={th.accents.teal} ink={th.line} strokeWidth={3} />
        </g>
        <ellipse cx={cx} cy={cy} rx={200} ry={60} fill="none" stroke={th.muted} strokeWidth={3} strokeDasharray="8 10" opacity={0.6} />
        <Dot x={cx + Math.cos(a) * 200} y={cy + Math.sin(a) * 60} r={12} color={ac} />
        <Arrow x1={cx} y1={cy + 210} x2={cx + 220} y2={cy + 210} color={ac} t={out(f, 10, 14)} w={9} head={28} />
        <IconG name={v.body} x={cx} y={cy - 220} size={90} t={out(f, 6, 16)} accent={ac} ink={th.line} strokeWidth={5} />
      </>
    );
  }
  return (
    <Abs>
      <Svg>{body}</Svg>
      <Caption text={v.label?.[lang]} th={th} f={f} bottom={6} />
    </Abs>
  );
};

/* ---------------- rays (optika) ---------------- */
const RAINBOW = ['#ff3b3b', '#ff8a1f', '#ffd21f', '#3ddc5a', '#2fb4ff', '#4b5bff', '#9b4bff'];

export const RaysV: React.FC<VProps<'rays'>> = ({v, f, th, lang, ac}) => {
  const t = prog(f, 4, 24);
  const white = th.dark ? '#ffffff' : '#2a2824';
  let body: React.ReactNode = null;
  if (v.mode === 'scatter' || v.mode === 'sunset') {
    const sunset = v.mode === 'sunset';
    const sx = sunset ? 90 : 120;
    const sy = sunset ? 470 : 120;
    const ex = sunset ? 820 : 700;
    const ey = sunset ? 470 : 600;
    const px = sx + (ex - sx) * t;
    const py = sy + (ey - sy) * t;
    body = (
      <>
        <rect x={0} y={sunset ? 320 : 230} width={W} height={sunset ? 300 : 290} fill={th.accents.blue} opacity={0.1} />
        <IconG name="sun" x={sx} y={sy} size={150} t={out(f, 0, 14)} accent={th.accents.yellow} ink={th.line} strokeWidth={4} />
        <line x1={sx} y1={sy} x2={px} y2={py} stroke={sunset ? `url(#sunsetGrad)` : white} strokeWidth={10} strokeLinecap="round" />
        <defs>
          <linearGradient id="sunsetGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.5" stopColor="#ffd37a" />
            <stop offset="1" stopColor="#ff6a3a" />
          </linearGradient>
        </defs>
        {Array.from({length: 12}, (_, i) => {
          const k = (i + 1) / 13;
          if (t < k) return null;
          const x = sx + (ex - sx) * k;
          const y = sy + (ey - sy) * k;
          const life = ((f - k * 30) % 40) / 40;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={9} fill={th.muted} />
              {[0, 1, 2, 3].map((j) => {
                const a = rand(i * 4 + j) * Math.PI * 2;
                const r = 30 + life * 120;
                return (
                  <path
                    key={j}
                    d={`M${x + Math.cos(a) * 20} ${y + Math.sin(a) * 20}Q${x + Math.cos(a + 0.3) * r * 0.6} ${y + Math.sin(a + 0.3) * r * 0.6} ${x + Math.cos(a) * r} ${y + Math.sin(a) * r}`}
                    stroke={th.accents.blue}
                    strokeWidth={5}
                    fill="none"
                    opacity={(1 - life) * (sunset ? 1 - k * 0.6 : 1)}
                  />
                );
              })}
            </g>
          );
        })}
        <IconG name="eye" x={ex + (sunset ? 0 : 40)} y={ey + (sunset ? 0 : 50)} size={120} t={out(f, 16, 14)} accent={sunset ? th.accents.red : th.accents.blue} ink={th.line} strokeWidth={5} />
      </>
    );
  } else if (v.mode === 'prism') {
    const spread = prog(f, 18, 20);
    body = (
      <>
        <line x1={40} y1={430} x2={40 + 330 * Math.min(1, t * 1.6)} y2={430 - 60 * Math.min(1, t * 1.6)} stroke={white} strokeWidth={12} strokeLinecap="round" />
        <path d="M450 160L640 520H260z" fill={th.accents.blue} fillOpacity={0.12} stroke={th.line} strokeWidth={5} strokeLinejoin="round" />
        {RAINBOW.map((c, i) => (
          <line key={c} x1={520} y1={350 + i * 4} x2={520 + 340 * spread} y2={330 + (i - 3) * 6 + (i - 0.5) * 60 * spread} stroke={c} strokeWidth={10} strokeLinecap="round" opacity={spread} />
        ))}
      </>
    );
  } else if (v.mode === 'refract') {
    const x1 = 160;
    const y1 = 80;
    const bx = 400;
    const by = 380;
    const ex = 540;
    const ey = 700;
    const a = Math.min(1, t * 2);
    const b = Math.max(0, t * 2 - 1);
    body = (
      <>
        <rect x={0} y={380} width={W} height={H - 380} fill={th.accents.blue} opacity={0.18} />
        <line x1={0} y1={380} x2={W} y2={380} stroke={th.accents.blue} strokeWidth={4} />
        <line x1={bx} y1={120} x2={bx} y2={680} stroke={th.muted} strokeWidth={2} strokeDasharray="8 10" />
        <line x1={x1} y1={y1} x2={x1 + (bx - x1) * a} y2={y1 + (by - y1) * a} stroke={ac} strokeWidth={9} strokeLinecap="round" />
        {b > 0 ? <line x1={bx} y1={by} x2={bx + (ex - bx) * b} y2={by + (ey - by) * b} stroke={ac} strokeWidth={9} strokeLinecap="round" /> : null}
        <line x1={bx} y1={by} x2={bx + (bx - x1) * b} y2={by + (by - y1) * b} stroke={th.muted} strokeWidth={4} strokeDasharray="10 10" opacity={0.6} />
      </>
    );
  } else if (v.mode === 'mirror') {
    const flip = out(f, 12, 22);
    body = (
      <>
        <line x1={450} y1={90} x2={450} y2={680} stroke={th.accents.blue} strokeWidth={10} />
        <g stroke={th.muted} strokeWidth={3} opacity={0.5}>
          {Array.from({length: 14}, (_, i) => (
            <line key={i} x1={460} y1={100 + i * 42} x2={480} y2={80 + i * 42} />
          ))}
        </g>
        <IconG name="hand" x={230} y={380} size={250} t={out(f, 0, 16)} accent={ac} ink={th.line} strokeWidth={4} />
        {/* zrcadlový obraz: osa zrcadla x = 450 */}
        <g transform="translate(900 0) scale(-1 1)" opacity={flip}>
          <IconG name="hand" x={230} y={380} size={250} accent={ac} ink={th.line} strokeWidth={4} />
        </g>
        <Arrow x1={330} y1={600} x2={570} y2={600} color={ac} t={prog(f, 20, 14)} w={8} head={24} dashed />
      </>
    );
  } else if (v.mode === 'twinkle') {
    const flick = 0.55 + 0.45 * Math.abs(Math.sin(f * 0.37) * Math.cos(f * 0.23));
    let d = '';
    for (let y = 150; y <= 620; y += 10) {
      const turb = y > 300 && y < 520 ? Math.sin(y * 0.05 + f * 0.25) * 26 : 0;
      d += `${y === 150 ? 'M' : 'L'}${450 + turb} ${y}`;
    }
    body = (
      <>
        {[330, 400, 470].map((y, i) => (
          <path key={y} d={`M0 ${y}C200 ${y - 30 + Math.sin(f * 0.1 + i) * 20} 600 ${y + 30} 900 ${y}`} stroke={th.accents.blue} strokeWidth={30} fill="none" opacity={0.12} />
        ))}
        <g opacity={flick}>
          <IconG name="star" x={450} y={100} size={130} t={out(f, 0, 14)} accent={th.accents.yellow} ink={th.line} strokeWidth={4} />
        </g>
        <path d={d} stroke={th.accents.yellow} strokeWidth={7} fill="none" opacity={t} />
        <IconG name="eye" x={450} y={670} size={120} t={out(f, 10, 14)} accent={ac} ink={th.line} strokeWidth={5} />
      </>
    );
  }
  return (
    <Abs>
      <Svg>{body}</Svg>
      <Caption text={v.label?.[lang]} th={th} f={f} bottom={6} />
    </Abs>
  );
};

/* ---------------- field (elektřina a magnetismus) ---------------- */
export const FieldV: React.FC<VProps<'field'>> = ({v, f, th, lang, ac}) => {
  const flow = -f * 2.4;
  const N = th.accents.red;
  const S = th.accents.blue;
  let body: React.ReactNode = null;
  if (v.mode === 'magnet') {
    body = (
      <>
        {[60, 120, 190, 260].map((h, i) => (
          <g key={h} opacity={out(f, i * 4, 14)}>
            <path d={`M270 360C270 ${360 - h * 1.3} 630 ${360 - h * 1.3} 630 360`} stroke={ac} strokeWidth={4} fill="none" strokeDasharray="14 12" strokeDashoffset={flow} />
            <path d={`M270 400C270 ${400 + h * 1.3} 630 ${400 + h * 1.3} 630 400`} stroke={ac} strokeWidth={4} fill="none" strokeDasharray="14 12" strokeDashoffset={flow} />
          </g>
        ))}
        <rect x={250} y={330} width={200} height={100} rx={8} fill={N} />
        <rect x={450} y={330} width={200} height={100} rx={8} fill={S} />
        <text x={350} y={398} textAnchor="middle" fill="#fff" fontFamily={MONO_FONT} fontWeight={600} fontSize={56}>
          N
        </text>
        <text x={550} y={398} textAnchor="middle" fill="#fff" fontFamily={MONO_FONT} fontWeight={600} fontSize={56}>
          S
        </text>
      </>
    );
  } else if (v.mode === 'coil') {
    const pulse = Math.sin(f * 0.25);
    const coil = (y: number, color: string) => (
      <g>
        {[0, 1, 2, 3].map((i) => (
          <ellipse key={i} cx={450} cy={y + i * 14} rx={220 - i * 26} ry={34 - i * 3} fill="none" stroke={color} strokeWidth={6} />
        ))}
      </g>
    );
    body = (
      <>
        <rect x={250} y={140} width={400} height={110} rx={20} fill="none" stroke={th.line} strokeWidth={4} opacity={0.6} />
        {coil(170, ac)}
        {[-150, -75, 0, 75, 150].map((dx, i) => (
          <path key={dx} d={`M${450 + dx} 520L${450 + dx * 1.05} 250`} stroke={pulse > 0 ? ac : th.accents.teal} strokeWidth={4} strokeDasharray="12 12" strokeDashoffset={pulse > 0 ? flow : -flow} opacity={0.4 + Math.abs(pulse) * 0.6 * out(f, i * 3, 12)} />
        ))}
        {coil(520, th.accents.teal)}
        <rect x={180} y={600} width={540} height={60} rx={30} fill={th.muted} opacity={0.3} />
        {Array.from({length: 8}, (_, i) => {
          const p = ((f * 0.02 + i / 8) % 1) * Math.PI * 2;
          return <circle key={i} cx={450 + Math.cos(p) * 200} cy={540 + Math.sin(p) * 30} r={8} fill={th.accents.yellow} opacity={out(f, 10, 10)} />;
        })}
      </>
    );
  } else if (v.mode === 'charge' || v.mode === 'spark') {
    const sparkAt = 34;
    const flash = f >= sparkAt ? Math.max(0, 1 - (f - sparkAt) / 10) : 0;
    const zig = `M450 ${v.mode === 'spark' ? 210 : 300}l-30 50 40 20-40 50 40 20-30 60`;
    const top = v.mode === 'spark' ? 'cloud' : 'hand';
    const bottom = v.mode === 'spark' ? 'house' : 'door';
    body = (
      <>
        <IconG name={top} x={450} y={v.mode === 'spark' ? 130 : 170} size={v.mode === 'spark' ? 280 : 220} t={out(f, 0, 14)} accent={ac} ink={th.line} strokeWidth={4} />
        <IconG name={bottom} x={450} y={590} size={240} t={out(f, 4, 14)} accent={ac} ink={th.line} strokeWidth={4} />
        {Array.from({length: 8}, (_, i) => (
          <text key={`m${i}`} x={300 + i * 43} y={v.mode === 'spark' ? 260 : 300} textAnchor="middle" fill={S} fontFamily={MONO_FONT} fontWeight={600} fontSize={44} opacity={pop(f, 6 + i * 2, 8)}>
            −
          </text>
        ))}
        {Array.from({length: 6}, (_, i) => (
          <text key={`p${i}`} x={340 + i * 44} y={490} textAnchor="middle" fill={N} fontFamily={MONO_FONT} fontWeight={600} fontSize={44} opacity={pop(f, 10 + i * 2, 8)}>
            +
          </text>
        ))}
        {flash > 0 ? (
          <>
            <path d={zig} stroke={th.accents.yellow} strokeWidth={10} fill="none" strokeLinejoin="round" opacity={flash} />
            <circle cx={450} cy={420} r={180} fill={th.accents.yellow} opacity={flash * 0.25} />
          </>
        ) : null}
      </>
    );
  }
  return (
    <Abs>
      <Svg>{body}</Svg>
      <Caption text={v.label?.[lang]} th={th} f={f} bottom={6} />
    </Abs>
  );
};

/* ---------------- fall (volný pád) ---------------- */
export const FallV: React.FC<VProps<'fall'>> = ({v, f, dur, th, lang, ac}) => {
  const fps = 30;
  const start = 12;
  const T = Math.max(1, Math.min(dur - start - 6, 50)) / fps; // doba pádu
  const tt = Math.max(0, (f - start) / fps);
  const g = 520 / (T * T * 0.5); // aby těžký předmět dopadl za T
  const yHeavy = Math.min(520, 0.5 * g * tt * tt);
  // s odporem vzduchu: lehký předmět rychle dosáhne mezní rychlosti
  const vt = 520 / (T * 2.4);
  const yLight = v.air ? Math.min(520, vt * tt) : yHeavy;
  const sway = v.air ? Math.sin(f * 0.15) * 26 : 0;
  return (
    <Abs>
      <Svg>
        <line x1={40} y1={680} x2={860} y2={680} stroke={th.line} strokeWidth={6} opacity={out(f, 0, 12)} />
        {Array.from({length: 11}, (_, i) => (
          <g key={i} opacity={0.35}>
            <line x1={450} y1={120 + i * 52} x2={470} y2={120 + i * 52} stroke={th.muted} strokeWidth={3} />
          </g>
        ))}
        <IconG name={v.left} x={250} y={100 + yHeavy} size={130} t={out(f, 0, 12)} accent={ac} ink={th.line} strokeWidth={5} />
        <IconG name={v.right} x={650 + sway} y={100 + yLight} size={130} t={out(f, 4, 12)} accent={th.accents.teal} ink={th.line} strokeWidth={5} />
        <text x={450} y={60} textAnchor="middle" fill={th.muted} fontFamily={MONO_FONT} fontWeight={600} fontSize={32} letterSpacing={2}>
          {`t = ${tt.toFixed(1)} s`}
        </text>
      </Svg>
      {!v.air ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 700, textAlign: 'center', fontFamily: MONO_FONT, fontSize: 26, color: th.muted, letterSpacing: 3, opacity: interpolate(f, [0, 10], [0, 1], {extrapolateRight: 'clamp'})}}>
          VACUUM · 0 Pa
        </div>
      ) : null}
      <Caption text={v.label?.[lang]} th={th} f={f} bottom={-60} />
    </Abs>
  );
};
