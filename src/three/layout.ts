import {CatmullRomCurve3, Vector3} from 'three';
import type {Vec3} from '../types';

/** Rozmístění objektů ve světě (metry). */
export const SUN_POS: Vec3 = [-2.2, 7.5, 1.5];

export const HOUSE = {width: 4, height: 2.5, depth: 3};
export const ROOF_ANGLE = Math.PI / 6; // 30°
export const ROOF_OVERHANG = 0.2;
const halfRun = HOUSE.depth / 2 + ROOF_OVERHANG;
export const ROOF_SLOPE_LEN = halfRun / Math.cos(ROOF_ANGLE);
export const ROOF_RISE = (HOUSE.depth / 2) * Math.tan(ROOF_ANGLE);
/** Střed přední (jižní) střešní plochy */
export const FRONT_SLOPE_CENTER: Vec3 = [0, HOUSE.height + ROOF_RISE / 2 + 0.02, halfRun / 2 - 0.0];

/** Převod lokálních souřadnic přední střešní plochy (x podél střechy, z po spádu) na svět. */
export const slopeToWorld = (x: number, z: number, lift = 0.12): Vec3 => {
  const a = ROOF_ANGLE;
  const [cx, cy, cz] = FRONT_SLOPE_CENTER;
  return [cx + x, cy - z * Math.sin(a) + lift * Math.cos(a), cz + z * Math.cos(a) + lift * Math.sin(a)];
};

export const INVERTER_POS: Vec3 = [2.12, 1.2, 0.6];

/** Kabel z panelů ke střídači (DC) */
export const DC_CURVE = new CatmullRomCurve3(
  [
    new Vector3(...slopeToWorld(1.85, 0.75, 0.08)),
    new Vector3(2.15, 2.55, 1.35),
    new Vector3(2.15, 2.05, 1.15),
    new Vector3(2.15, 1.7, 0.9),
    new Vector3(2.15, 1.58, 0.62),
  ],
  false,
  'catmullrom',
  0.2,
);

/** Kabel ze střídače do domu (AC) */
export const AC_CURVE = new CatmullRomCurve3(
  [
    new Vector3(2.15, 0.82, 0.6),
    new Vector3(2.15, 0.55, 0.45),
    new Vector3(2.15, 0.5, 0.0),
    new Vector3(2.15, 0.55, -0.5),
    new Vector3(2.03, 0.6, -0.8),
  ],
  false,
  'catmullrom',
  0.2,
);

/** Deterministický pseudo-náhodný generátor 0..1 */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
