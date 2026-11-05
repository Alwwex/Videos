import React from 'react';
import type {CatmullRomCurve3} from 'three';
import {SUN_POS, rand, slopeToWorld} from './layout';

const PHOTONS = 16;
const PERIOD = 34;

/** Fotony letící ze Slunce na panely; při dopadu "vyrazí" elektron. */
export const Photons: React.FC<{frame: number}> = ({frame}) => (
  <group>
    {Array.from({length: PHOTONS}).map((_, i) => {
      const t = (frame / PERIOD + i / PHOTONS) % 1;
      const cycle = Math.floor(frame / PERIOD + i / PHOTONS);
      const seed = i * 13 + cycle * 7;
      const start: [number, number, number] = [
        SUN_POS[0] + (rand(seed) - 0.5) * 1.6,
        SUN_POS[1] + (rand(seed + 1) - 0.5) * 1.6,
        SUN_POS[2] + (rand(seed + 2) - 0.5) * 1.6,
      ];
      const end = slopeToWorld((rand(seed + 3) - 0.5) * 3.6, (rand(seed + 4) - 0.5) * 1.5, 0.18);
      const flying = Math.min(1, t / 0.82);
      const pos = start.map((s, k) => s + (end[k] - s) * flying) as [number, number, number];
      const impact = t > 0.82 ? (t - 0.82) / 0.18 : 0;
      return (
        <group key={i}>
          {impact === 0 ? (
            <mesh position={pos} rotation={[frame * 0.2, frame * 0.15, 0]}>
              <octahedronGeometry args={[0.13, 0]} />
              <meshBasicMaterial color="#ffd400" toneMapped={false} />
            </mesh>
          ) : (
            <>
              {/* záblesk */}
              <mesh position={end} scale={0.25 + impact * 0.5}>
                <icosahedronGeometry args={[0.3, 0]} />
                <meshBasicMaterial color="#fff3a0" toneMapped={false} transparent opacity={(1 - impact) * 0.8} depthWrite={false} />
              </mesh>
              {/* uvolněný elektron */}
              <mesh position={[end[0], end[1] + impact * 0.45, end[2] + impact * 0.25]}>
                <icosahedronGeometry args={[0.07, 0]} />
                <meshBasicMaterial color="#4fd8ff" toneMapped={false} />
              </mesh>
            </>
          )}
        </group>
      );
    })}
  </group>
);

/** Částice proudu putující po kabelu. */
export const Current: React.FC<{
  curve: CatmullRomCurve3;
  frame: number;
  color: string;
  count: number;
  speed: number;
  wobble?: boolean;
}> = ({curve, frame, color, count, speed, wobble}) => (
  <group>
    {Array.from({length: count}).map((_, i) => {
      let t = (frame * speed + i / count) % 1;
      if (wobble) t = Math.min(1, Math.max(0, t + Math.sin(frame * 0.6 + i) * 0.03));
      const p = curve.getPointAt(t);
      return (
        <group key={i} position={[p.x, p.y, p.z]}>
          <mesh>
            <icosahedronGeometry args={[0.07, 0]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh scale={2.2}>
            <icosahedronGeometry args={[0.07, 0]} />
            <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.3} depthWrite={false} />
          </mesh>
        </group>
      );
    })}
  </group>
);
