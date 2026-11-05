import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';

type Word = {text: string; highlight: boolean};

/** "NA *SOLÁRNÍ PANELY*" → [{NA}, {SOLÁRNÍ, žlutě}, {PANELY, žlutě}] */
export const parseCaption = (caption: string): Word[] =>
  caption
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .flatMap((part) => {
      const highlight = part.startsWith('*') && part.endsWith('*');
      const clean = highlight ? part.slice(1, -1) : part;
      return clean
        .split(/\s+/)
        .filter(Boolean)
        .map((text) => ({text: text.toUpperCase(), highlight}));
    });

type Props = {
  /** Seznam titulků (2–4 slova); bez časů se rozloží rovnoměrně na délku scény */
  captions: string[];
  durationInFrames: number;
  /** Volitelně: snímek, kdy se má každý titulek objevit (např. podle hlasu) */
  starts?: number[];
  /** Volitelně: snímek každého slova v titulku → karaoke (slovo naskočí, když zazní) */
  wordStarts?: number[][];
  highlightColor?: string;
  /** Vzdálenost od spodního okraje v px */
  bottom?: number;
  font?: string;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const Titulek: React.FC<Props> = ({
  captions,
  durationInFrames,
  starts,
  wordStarts,
  highlightColor = '#FFD43B',
  bottom = 360,
  font = fontFamily,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (captions.length === 0) return null;

  const per = durationInFrames / captions.length;
  let index = Math.min(captions.length - 1, Math.floor(frame / per));
  let capStart = index * per;
  let nextStart = index + 1 < captions.length ? (index + 1) * per : Infinity;
  if (starts && starts.length === captions.length) {
    index = 0;
    starts.forEach((s, i) => {
      if (frame >= s) index = i;
    });
    capStart = starts[index];
    nextStart = starts[index + 1] ?? Infinity;
  }
  const words = parseCaption(captions[index]);
  const ws = wordStarts?.[index]?.length === words.length ? wordStarts[index] : null;

  // krátký odchod těsně před dalším titulkem
  const exit = Number.isFinite(nextStart) ? clamp01((frame - (nextStart - 3)) / 3) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        bottom,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-end',
        columnGap: 38,
        rowGap: 4,
        fontFamily: font,
        fontWeight: 900,
        fontSize: 104,
        lineHeight: 1.08,
        textAlign: 'center',
        opacity: 1 - exit,
        transform: `scale(${1 - exit * 0.08})`,
      }}
    >
      {words.map((w, i) => {
        const appear = ws ? ws[i] - 2 : capStart + i * 3;
        const pop = spring({frame: frame - appear, fps, config: {damping: 12, stiffness: 210, mass: 0.55}});
        // právě vyslovované slovo se o kousek zvětší a nadzvedne
        let active = 0;
        if (ws) {
          const on = clamp01((frame - ws[i]) / 3);
          const off = i + 1 < ws.length ? clamp01((frame - ws[i + 1]) / 4) : clamp01((frame - (ws[i] + 18)) / 6);
          active = on * (1 - off);
        }
        const lift = interpolate(active, [0, 1], [0, -8]);
        return (
          <span
            key={`${index}-${i}`}
            style={{
              display: 'inline-block',
              color: w.highlight ? highlightColor : '#FFFFFF',
              transform: `translateY(${(1 - pop) * 34 + lift}px) scale(${(0.55 + pop * 0.45) * (1 + active * 0.09)})`,
              opacity: clamp01(pop * 1.6),
              WebkitTextStroke: '10px rgba(20,12,4,0.9)',
              paintOrder: 'stroke fill',
              textShadow: `0 10px 0 rgba(20,12,4,0.55), 0 18px 40px rgba(0,0,0,0.45)${active > 0.5 && w.highlight ? `, 0 0 34px ${highlightColor}88` : ''}`,
              letterSpacing: -1,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
