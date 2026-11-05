import React, {useMemo} from 'react';
import {AdditiveBlending, CanvasTexture, Color} from 'three';

/* "Bloom" bez postprocessingu: měkká aditivní aureola (sprite vždy čelem ke kameře).
 * Funguje spolehlivě v Remotion renderu a stojí skoro nic. */

let tex: CanvasTexture | null = null;
const haloTexture = () => {
  if (tex) return tex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  // rychlý pokles u středu + dlouhý měkký okraj = vzhled jako bloom
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.05)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  tex = new CanvasTexture(cv);
  return tex;
};

export const Halo: React.FC<{color: string; size: number; opacity?: number; position?: [number, number, number]}> = ({
  color,
  size,
  opacity = 0.6,
  position,
}) => {
  const col = useMemo(() => new Color(color), [color]);
  return (
    <sprite position={position} scale={[size, size, 1]} renderOrder={10}>
      <spriteMaterial map={haloTexture()} color={col} transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </sprite>
  );
};
