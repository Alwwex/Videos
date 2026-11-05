import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';

type Props = {
  emoji: string;
  text: string;
  /** Bod na obrazovce (px), na který štítek ukazuje */
  x: number;
  y: number;
  /** Posun štítku od bodu (px) */
  offset: [number, number];
  delay?: number;
  font?: string;
};

export const Stitek: React.FC<Props> = ({emoji, text, x, y, offset, delay = 0, font = fontFamily}) => {
  const frame = useCurrentFrame() - delay;
  const {fps, width, height} = useVideoConfig();

  const dot = spring({frame, fps, config: {damping: 10, stiffness: 200}});
  const line = interpolate(frame, [4, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pill = spring({frame: frame - 12, fps, config: {damping: 12, stiffness: 170}});

  // štítek držíme uvnitř obrazu
  const halfW = (text.length * 30 + 150) / 2 + 30;
  const lx = Math.max(halfW, Math.min(width - halfW, x + offset[0]));
  const ly = Math.max(140, Math.min(height - 140, y + offset[1]));
  const ex = x + (lx - x) * line;
  const ey = y + (ly - y) * line;

  if (frame < 0) return null;

  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <line x1={x} y1={y} x2={ex} y2={ey} stroke="rgba(20,12,4,0.55)" strokeWidth={12} strokeLinecap="round" />
        <line x1={x} y1={y} x2={ex} y2={ey} stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" />
        <circle cx={x} cy={y} r={20 * dot} fill="#FFFFFF" />
        <circle cx={x} cy={y} r={12 * dot} fill="#FFD43B" />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: lx,
          top: ly,
          transform: `translate(-50%, -50%) scale(${pill})`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 30px 14px 20px',
          background: '#FFFFFF',
          borderRadius: 999,
          boxShadow: '0 10px 0 rgba(20,12,4,0.35), 0 16px 40px rgba(0,0,0,0.3)',
          fontFamily: font,
          fontWeight: 800,
          fontSize: 46,
          color: '#24160A',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{fontSize: 52, lineHeight: 1}}>{emoji}</span>
        <span>{text}</span>
      </div>
    </div>
  );
};
