import React, {useMemo} from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {Easing, interpolate} from 'remotion';
import {IconG, IconSvg} from '../Icons';
import type {CurveName} from '../schema';
import {BODY_FONT, HEAD_FONT, MONO_FONT} from '../theme';
import {Abs, Arrow, Caption, Dot, H, Mono, Svg, W, fmt, out, pop, prog, type VProps} from './common';

/* ---------------- icon ---------------- */
export const IconV: React.FC<VProps<'icon'>> = ({v, f, th, lang, ac}) => {
  const effect = (k: number) => {
    switch (v.effect) {
      case 'pulse':
        return `scale(${1 + Math.sin((f + k * 10) * 0.18) * 0.04})`;
      case 'shake':
        return `translate(${Math.sin(f * 1.3 + k) * 5}px, ${Math.cos(f * 1.7 + k) * 3}px)`;
      case 'spin':
        return `rotate(${f * 1.4}deg)`;
      case 'float':
        return `translateY(${Math.sin((f + k * 20) * 0.09) * 14}px)`;
      default:
        return 'none';
    }
  };
  const t1 = out(f, 0, 22);
  const t2 = out(f, 10, 22);
  const two = !!v.icon2;
  const size = two ? 290 : 430;
  const y = v.caption ? 330 : 370;
  return (
    <Abs>
      <div style={{position: 'absolute', left: two ? 450 - 210 - size / 2 : 450 - size / 2, top: y - size / 2, transform: effect(0)}}>
        <IconSvg name={v.icon} size={size} t={t1} accent={ac} ink={th.line} />
      </div>
      {two ? (
        <>
          <div style={{position: 'absolute', left: 450 + 210 - size / 2, top: y - size / 2, transform: effect(1)}}>
            <IconSvg name={v.icon2!} size={size} t={t2} accent={ac} ink={th.line} />
          </div>
          <Svg>
            {v.relation === 'arrow' ? <Arrow x1={395} y1={y} x2={505} y2={y} color={ac} t={prog(f, 14, 14)} w={9} /> : null}
            {v.relation === 'plus' ? (
              <g opacity={pop(f, 14)} stroke={ac} strokeWidth={10} strokeLinecap="round">
                <line x1={450} y1={y - 34} x2={450} y2={y + 34} />
                <line x1={416} y1={y} x2={484} y2={y} />
              </g>
            ) : null}
          </Svg>
          {v.relation === 'vs' ? (
            <div style={{position: 'absolute', left: 0, right: 0, top: y - 46, textAlign: 'center', fontFamily: HEAD_FONT, fontWeight: 900, fontSize: 76, color: ac, transform: `scale(${pop(f, 14)})`}}>VS</div>
          ) : null}
        </>
      ) : null}
      <Caption text={v.caption?.[lang]} th={th} f={f} />
    </Abs>
  );
};

/* ---------------- formula ---------------- */
export const FormulaV: React.FC<VProps<'formula'>> = ({v, f, th, lang, ac}) => {
  const html = useMemo(() => {
    try {
      // \hl{...} → barva zvýraznění (makro s "#" v hex barvě KaTeX neumí)
      const tex = v.tex.replace(/\\hl\{/g, `\\textcolor{${ac}}{`);
      return katex.renderToString(tex, {displayMode: true, throwOnError: false, strict: 'ignore', output: 'html'});
    } catch {
      return v.tex;
    }
  }, [v.tex, ac]);
  const plain = v.tex.replace(/\\[a-z]+|[{}^_]/gi, '');
  const size = plain.length > 22 ? 64 : plain.length > 14 ? 82 : 104;
  const t = out(f, 2, 18);
  const sweep = prog(f, 16, 22);
  return (
    <Abs>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: v.caption ? 220 : 270,
          textAlign: 'center',
          color: th.ink,
          fontSize: size,
          opacity: t,
          transform: `translateY(${(1 - t) * 30}px) scale(${0.92 + t * 0.08})`,
          filter: `blur(${(1 - t) * 8}px)`,
        }}
        dangerouslySetInnerHTML={{__html: html}}
      />
      <Svg>
        <line x1={450 - 300 * sweep} y1={v.caption ? 470 : 520} x2={450 + 300 * sweep} y2={v.caption ? 470 : 520} stroke={ac} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
      </Svg>
      <Caption text={v.caption?.[lang]} th={th} f={f} delay={20} bottom={110} />
    </Abs>
  );
};

/* ---------------- counter ---------------- */
export const CounterV: React.FC<VProps<'counter'>> = ({v, f, dur, th, lang, ac}) => {
  const t = prog(f, 4, Math.max(20, dur * 0.6), Easing.out(Easing.cubic));
  const val = v.from + (v.to - v.from) * t;
  const txt = fmt(val, v.decimals, lang);
  const len = (fmt(v.to, v.decimals, lang) + v.unit[lang]).length;
  const size = Math.min(210, Math.floor(1500 / Math.max(4, len)));
  return (
    <Abs>
      <Svg>
        {Array.from({length: 41}, (_, i) => {
          const x = 60 + i * 19.5;
          const on = i / 40 <= t;
          return <line key={i} x1={x} y1={560} x2={x} y2={i % 5 === 0 ? 520 : 540} stroke={on ? ac : th.muted} strokeWidth={i % 5 === 0 ? 4 : 2} opacity={on ? 1 : 0.4} />;
        })}
      </Svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 230,
          textAlign: 'center',
          fontFamily: HEAD_FONT,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1,
          color: th.ink,
          fontVariantNumeric: 'tabular-nums',
          transform: `scale(${0.85 + pop(f, 0, 14) * 0.15})`,
        }}
      >
        {txt}
        <span style={{color: ac, fontSize: size * 0.5}}>{v.unit[lang]}</span>
      </div>
      <Caption text={v.caption[lang]} th={th} f={f} delay={10} bottom={90} />
    </Abs>
  );
};

/* ---------------- gauge ---------------- */
export const GaugeV: React.FC<VProps<'gauge'>> = ({v, f, dur, th, lang, ac}) => {
  const cx = 450;
  const cy = 370;
  const R = 285;
  const a0 = Math.PI * 0.75; // 135°
  const span = Math.PI * 1.5; // 270°
  const t = prog(f, 6, Math.max(20, dur * 0.55), Easing.out(Easing.cubic));
  const val = v.from + (v.to - v.from) * t;
  const frac = Math.max(0, Math.min(1, val / Math.max(1e-9, v.max)));
  const ang = a0 + span * frac;
  const pt = (a: number, r: number) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const arc = (r: number, from: number, to: number) => {
    const [x1, y1] = pt(from, r);
    const [x2, y2] = pt(to, r);
    return `M${x1} ${y1}A${r} ${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const draw = out(f, 0, 16);
  return (
    <Abs>
      <Svg>
        <path d={arc(R, a0, a0 + span * draw)} stroke={th.muted} strokeWidth={6} fill="none" opacity={0.5} />
        <path d={arc(R, a0, ang)} stroke={ac} strokeWidth={14} fill="none" strokeLinecap="round" />
        {Array.from({length: 31}, (_, i) => {
          const a = a0 + (span * i) / 30;
          const [x1, y1] = pt(a, R - 30);
          const [x2, y2] = pt(a, R - (i % 5 === 0 ? 70 : 48));
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={th.line} strokeWidth={i % 5 === 0 ? 5 : 2.5} opacity={draw} />;
        })}
        {Array.from({length: 7}, (_, i) => {
          const a = a0 + (span * i) / 6;
          const [x, y] = pt(a, R - 110);
          return (
            <text key={i} x={x} y={y + 10} textAnchor="middle" fill={th.muted} fontFamily={MONO_FONT} fontSize={28} opacity={draw}>
              {fmt((v.max * i) / 6, 0, lang)}
            </text>
          );
        })}
        <line x1={cx} y1={cy} x2={pt(ang, R - 60)[0]} y2={pt(ang, R - 60)[1]} stroke={ac} strokeWidth={10} strokeLinecap="round" />
        <Dot x={cx} y={cy} r={16} color={ac} />
      </Svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: 545, textAlign: 'center', fontFamily: HEAD_FONT, fontWeight: 900, fontSize: 92, color: th.ink, fontVariantNumeric: 'tabular-nums'}}>
        {fmt(val, 0, lang)}
        <span style={{fontSize: 46, color: ac}}>{v.unit[lang]}</span>
      </div>
      <Caption text={v.caption[lang]} th={th} f={f} delay={10} bottom={8} />
    </Abs>
  );
};

/* ---------------- graph ---------------- */
const CURVE_FN: Record<CurveName, (x: number) => number> = {
  linear: (x) => x,
  quadratic: (x) => x * x,
  sqrt: (x) => Math.sqrt(x),
  exp: (x) => (Math.exp(3 * x) - 1) / (Math.exp(3) - 1),
  decay: (x) => Math.exp(-3.2 * x),
  saturate: (x) => 1 - Math.exp(-4 * x),
  sine: (x) => 0.5 + 0.42 * Math.sin(x * Math.PI * 4),
  inverse: (x) => 0.08 / (x + 0.08),
  bell: (x) => Math.exp(-Math.pow((x - 0.5) / 0.17, 2)),
  flat: () => 0.5,
};

export const GraphV: React.FC<VProps<'graph'>> = ({v, f, dur, th, lang, ac}) => {
  const x0 = 110;
  const y0 = 640;
  const w = 720;
  const h = 520;
  const axis = out(f, 0, 14);
  const t = prog(f, 10, Math.max(24, dur * 0.6));
  const path = (fn: (x: number) => number, upto: number) => {
    const n = 80;
    let d = '';
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * upto;
      d += `${i ? 'L' : 'M'}${x0 + x * w} ${y0 - fn(x) * h}`;
    }
    return d;
  };
  const fn = CURVE_FN[v.curve];
  const hx = x0 + t * w;
  const hy = y0 - fn(t) * h;
  return (
    <Abs>
      <Svg>
        {Array.from({length: 6}, (_, i) => (
          <line key={`g${i}`} x1={x0} y1={y0 - (h * (i + 1)) / 6} x2={x0 + w * axis} y2={y0 - (h * (i + 1)) / 6} stroke={th.muted} strokeWidth={1.5} opacity={0.22} />
        ))}
        <Arrow x1={x0} y1={y0} x2={x0 + w + 30} y2={y0} color={th.line} t={axis} w={4} head={18} />
        <Arrow x1={x0} y1={y0} x2={x0} y2={y0 - h - 40} color={th.line} t={axis} w={4} head={18} />
        {v.curve2 ? <path d={path(CURVE_FN[v.curve2], t)} stroke={th.muted} strokeWidth={6} fill="none" strokeDasharray="14 12" opacity={0.8} /> : null}
        <path d={path(fn, t)} stroke={ac} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {t > 0.01 ? <Dot x={hx} y={hy} r={13} color={ac} /> : null}
        <text x={x0 + w + 20} y={y0 + 52} textAnchor="end" fill={th.muted} fontFamily={MONO_FONT} fontWeight={600} fontSize={28} letterSpacing={2}>
          {v.x[lang].toUpperCase()}
        </text>
        <text x={x0 + 18} y={y0 - h - 20} fill={th.muted} fontFamily={MONO_FONT} fontWeight={600} fontSize={28} letterSpacing={2}>
          {v.y[lang].toUpperCase()}
        </text>
      </Svg>
      {v.markLabel && t > 0.6 ? (
        <div
          style={{
            position: 'absolute',
            left: Math.min(W - 330, Math.max(20, hx - 160)),
            top: Math.max(10, Math.min(H - 120, hy - (fn(t) > 0.7 ? -40 : 100))),
            width: 320,
            textAlign: 'center',
            fontFamily: BODY_FONT,
            fontWeight: 800,
            fontSize: 36,
            color: ac,
            opacity: prog(f, 10 + dur * 0.4, 10),
          }}
        >
          {v.markLabel[lang]}
        </div>
      ) : null}
    </Abs>
  );
};

/* ---------------- bars ---------------- */
export const BarsV: React.FC<VProps<'bars'>> = ({v, f, dur, th, lang, ac}) => {
  const max = Math.max(...v.items.map((i) => Math.abs(i.value)), 1e-9);
  const n = v.items.length;
  const rowH = Math.min(170, 640 / n);
  const top = (H - rowH * n) / 2;
  return (
    <Abs>
      {v.items.map((it, i) => {
        const t = prog(f, 6 + i * 8, Math.max(18, dur * 0.45), Easing.out(Easing.cubic));
        const wpx = Math.max(8, (Math.abs(it.value) / max) * 760 * t);
        const color = it.highlight ? ac : th.muted;
        const decimals = Number.isInteger(it.value) ? 0 : it.value < 10 ? 1 : 0;
        return (
          <div key={i} style={{position: 'absolute', left: 50, top: top + i * rowH, width: 800, height: rowH}}>
            <div style={{fontFamily: BODY_FONT, fontWeight: 800, fontSize: 36, color: th.ink, opacity: out(f, i * 6, 10)}}>{it.label[lang]}</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 10}}>
              <div style={{width: wpx, height: 46, borderRadius: 10, background: color, boxShadow: it.highlight ? `0 0 30px ${ac}66` : 'none', opacity: it.highlight ? 1 : 0.55}} />
              <div style={{fontFamily: MONO_FONT, fontWeight: 600, fontSize: 34, color, whiteSpace: 'nowrap', opacity: t}}>
                {fmt(it.value * t, decimals, lang)}
                {v.unit[lang]}
              </div>
            </div>
          </div>
        );
      })}
    </Abs>
  );
};

/* ---------------- compare ---------------- */
export const CompareV: React.FC<VProps<'compare'>> = ({v, f, th, lang, ac}) => {
  const card = (side: 'left' | 'right', i: number) => {
    const s = v[side];
    const win = v.winner === side;
    const t = pop(f, i * 8, 14);
    const decided = prog(f, 26, 12);
    return (
      <div
        style={{
          position: 'absolute',
          top: 90,
          left: side === 'left' ? 30 : 470,
          width: 400,
          height: 560,
          borderRadius: 28,
          border: `4px solid ${win ? ac : th.panelBorder}`,
          background: win ? `${ac}14` : 'transparent',
          boxShadow: win ? `0 0 ${50 * decided}px ${ac}44` : 'none',
          transform: `scale(${0.8 + t * 0.2 + (win ? decided * 0.03 : 0)})`,
          opacity: Math.min(1, t) * (v.winner !== 'none' && !win ? 1 - decided * 0.35 : 1),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 40,
        }}
      >
        <IconSvg name={s.icon} size={230} t={out(f, i * 8, 20)} accent={win ? ac : th.muted} ink={th.line} />
        <div style={{marginTop: 26, fontFamily: BODY_FONT, fontWeight: 800, fontSize: 40, color: th.ink, textAlign: 'center', padding: '0 20px', lineHeight: 1.15}}>{s.label[lang]}</div>
        {s.value ? <div style={{marginTop: 14, fontFamily: MONO_FONT, fontWeight: 600, fontSize: 38, color: win ? ac : th.muted}}>{s.value[lang]}</div> : null}
      </div>
    );
  };
  return (
    <Abs>
      {card('left', 0)}
      {card('right', 1)}
      <div style={{position: 'absolute', left: 400, top: 330, width: 100, height: 100, borderRadius: 50, background: th.dark ? '#0008' : '#fff', border: `3px solid ${th.panelBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: HEAD_FONT, fontWeight: 900, fontSize: 38, color: th.ink, transform: `scale(${pop(f, 12)})`}}>
        VS
      </div>
    </Abs>
  );
};

/* ---------------- steps ---------------- */
export const StepsV: React.FC<VProps<'steps'>> = ({v, f, th, lang, ac}) => {
  const n = v.items.length;
  const gap = Math.min(170, 640 / n);
  const top = (H - gap * n) / 2 + 20;
  const done = th.accents.teal;
  return (
    <Abs>
      <Svg>
        <line x1={110} y1={top + 40} x2={110} y2={top + 40 + gap * (n - 1) * out(f, 0, 20)} stroke={th.muted} strokeWidth={4} opacity={0.5} />
      </Svg>
      {v.items.map((it, i) => {
        const state = i < v.active ? 'done' : i === v.active ? 'active' : 'todo';
        const color = state === 'done' ? done : state === 'active' ? ac : th.muted;
        const t = out(f, i * 5, 12);
        const pulse = state === 'active' ? 1 + Math.sin(f * 0.2) * 0.06 : 1;
        return (
          <div key={i} style={{position: 'absolute', left: 60, top: top + i * gap, display: 'flex', alignItems: 'center', gap: 34, opacity: t * (state === 'todo' ? 0.5 : 1), transform: `translateX(${(1 - t) * -30}px)`}}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                border: `5px solid ${color}`,
                background: state === 'todo' ? 'transparent' : color,
                color: th.dark ? '#0b0b10' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: HEAD_FONT,
                fontWeight: 900,
                fontSize: 46,
                transform: `scale(${pulse})`,
                boxShadow: state === 'active' ? `0 0 40px ${ac}88` : 'none',
              }}
            >
              {state === 'done' ? '✓' : i + 1}
            </div>
            <div style={{fontFamily: BODY_FONT, fontWeight: 800, fontSize: state === 'active' ? 50 : 42, color: state === 'active' ? th.ink : th.muted, maxWidth: 640, lineHeight: 1.1}}>{it[lang]}</div>
          </div>
        );
      })}
    </Abs>
  );
};

/* ---------------- quiz ---------------- */
export const QuizV: React.FC<VProps<'quiz'>> = ({v, f, dur, th, lang, ac}) => {
  const reveal = prog(f, dur * 0.68, 10);
  const n = v.options.length;
  const cols = n > 2 ? 2 : 1;
  const letters = 'ABCD';
  return (
    <Abs>
      <div style={{position: 'absolute', left: 30, right: 30, top: 20, textAlign: 'center', fontFamily: BODY_FONT, fontWeight: 800, fontSize: 44, color: th.ink, lineHeight: 1.15, opacity: out(f, 0, 12)}}>{v.question[lang]}</div>
      <div style={{position: 'absolute', left: 30, right: 30, top: 190, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 26}}>
        {v.options.map((o, i) => {
          const ok = i === v.answer;
          const t = pop(f, 6 + i * 5, 12);
          const color = ok && reveal > 0 ? ac : th.panelBorder;
          return (
            <div
              key={i}
              style={{
                height: n > 2 ? 230 : 180,
                borderRadius: 24,
                border: `4px solid ${color}`,
                background: ok ? `${ac}${Math.round(reveal * 40).toString(16).padStart(2, '0')}` : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '0 26px',
                transform: `scale(${t * (1 + (ok ? reveal * 0.04 : 0))})`,
                opacity: ok ? 1 : 1 - reveal * 0.55,
              }}
            >
              <div style={{fontFamily: HEAD_FONT, fontWeight: 900, fontSize: 54, color: ok && reveal > 0 ? ac : th.muted}}>{ok && reveal > 0.5 ? '✓' : letters[i]}</div>
              <div style={{fontFamily: BODY_FONT, fontWeight: 700, fontSize: 36, color: th.ink, lineHeight: 1.15}}>{o[lang]}</div>
            </div>
          );
        })}
      </div>
      {reveal < 0.01 ? (
        <Svg>
          <circle cx={450} cy={H - 50} r={34} fill="none" stroke={th.muted} strokeWidth={5} opacity={0.4} />
          <circle
            cx={450}
            cy={H - 50}
            r={34}
            fill="none"
            stroke={ac}
            strokeWidth={6}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={interpolate(f, [0, dur * 0.68], [0, 1], {extrapolateRight: 'clamp'})}
            transform={`rotate(-90 450 ${H - 50})`}
          />
        </Svg>
      ) : null}
    </Abs>
  );
};

/* ---------------- outro ---------------- */
export const OutroV: React.FC<VProps<'outro'>> = ({f, th, ac, nextTitle, seriesTitle, followText, nextLabel}) => {
  const badge = pop(f, 0, 16);
  const btn = pop(f, 14, 14);
  const press = f > 40 ? Math.max(0, 1 - Math.abs(f - 48) / 6) : 0;
  return (
    <Abs>
      <div style={{position: 'absolute', left: 300, top: 30, width: 300, height: 300, borderRadius: 60, border: `4px solid ${th.panelBorder}`, background: th.dark ? '#ffffff0a' : '#ffffff99', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${badge}) rotate(${(1 - badge) * -12}deg)`}}>
        <div style={{transform: `rotate(${f * 0.8}deg)`}}>
          <IconSvg name="atom" size={210} accent={ac} ink={th.line} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 360, textAlign: 'center', fontFamily: HEAD_FONT, fontWeight: 900, fontSize: 46, letterSpacing: 1, color: th.ink, opacity: out(f, 6, 12)}}>{seriesTitle}</div>
      <div
        style={{
          position: 'absolute',
          left: 225,
          top: 440,
          width: 450,
          height: 96,
          borderRadius: 48,
          background: press > 0.5 ? th.muted : ac,
          color: th.dark ? '#0b0b10' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: HEAD_FONT,
          fontWeight: 900,
          fontSize: 40,
          transform: `scale(${btn * (1 - press * 0.06)})`,
          boxShadow: `0 0 50px ${ac}66`,
        }}
      >
        {press > 0.5 || f > 48 ? '✓ ' : '+ '}
        {followText}
      </div>
      {nextTitle ? (
        <div style={{position: 'absolute', left: 40, right: 40, top: 590, textAlign: 'center', opacity: out(f, 22, 14), transform: `translateY(${(1 - out(f, 22, 14)) * 20}px)`}}>
          <Mono color={th.muted} size={26}>
            {nextLabel}
          </Mono>
          <div style={{marginTop: 8, fontFamily: BODY_FONT, fontWeight: 800, fontSize: 42, color: ac, lineHeight: 1.15}}>{nextTitle}</div>
        </div>
      ) : null}
    </Abs>
  );
};

export {IconG};
