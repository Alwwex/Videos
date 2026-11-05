import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';

type Props = {
  from: number;
  to: number;
  prefix?: string;
  suffix?: string;
  label?: string;
  decimals?: number;
  /** Za kolik snímků se dopočítá do cílové hodnoty */
  countFrames?: number;
  /** Zpoždění startu ve snímcích */
  delay?: number;
  top?: number;
  color?: string;
  font?: string;
};

const format = (n: number, decimals: number) =>
  n
    .toFixed(decimals)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const Pocitadlo: React.FC<Props> = ({
  from,
  to,
  prefix = '',
  suffix = '',
  label,
  decimals = 0,
  countFrames = 55,
  delay = 4,
  top = 210,
  color = '#FFD43B',
  font = fontFamily,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const value = interpolate(frame - delay, [0, countFrames], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const enter = spring({frame: frame - delay, fps, config: {damping: 12, stiffness: 140}});
  // malé "ťuknutí" ve chvíli, kdy počítadlo doběhne
  const done = spring({frame: frame - delay - countFrames, fps, config: {damping: 8, stiffness: 220}});
  const bump = 1 + Math.sin(Math.min(done, 1) * Math.PI) * 0.08;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: font,
        transform: `scale(${enter * bump})`,
        opacity: enter,
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 210,
          lineHeight: 1,
          color,
          fontVariantNumeric: 'tabular-nums',
          WebkitTextStroke: '12px rgba(20,12,4,0.9)',
          paintOrder: 'stroke fill',
          textShadow: '0 12px 0 rgba(20,12,4,0.5), 0 24px 60px rgba(0,0,0,0.35)',
          whiteSpace: 'nowrap',
        }}
      >
        {prefix}
        {format(value, decimals)}
        <span style={{fontSize: 110, color: '#FFFFFF'}}>{suffix}</span>
      </div>
      {label ? (
        <div
          style={{
            marginTop: 18,
            padding: '12px 30px',
            borderRadius: 999,
            background: 'rgba(20,12,4,0.72)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: 44,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};
