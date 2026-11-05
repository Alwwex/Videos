import {Easing, interpolate} from 'remotion';
import type {CameraShot, Vec3} from '../types';
import type {CameraSpec, PropSpec, PropType} from './schema';

/** Výška "středu" dílu nad jeho počátkem (při scale 1) – sem míří kamera a štítky. */
export const ANCHOR_Y: Record<PropType, number> = {
  sun: 0, moon: 0, earth: 0, cloud: 0, tree: 1.4, mountain: 1.4, house: 1.2, car: 0.6, plane: 0,
  rocket: 1.1, boat: 0.5, hotAirBalloon: 2.0, ball: 0.4, magnet: 0.6, battery: 0.5, bulb: 0.85,
  phone: 0.5, pot: 0.35, stove: 0.6, fridge: 1, microwave: 0.35, cup: 0.25, iceCube: 0.25,
  waterPool: 0.1, person: 1.1, arrow: 0, arrowUp: 0, arrowDown: 0, windTurbine: 3, snowflake: 0,
  thermometer: 0.8, speaker: 0.5, satellite: 0, lightning: 0, solarPanel: 0.7, atom: 0, lens: 0,
  prism: 0.5, table: 0.85,
  banana: 0.15, clock: 0.6, cat: 0.32, candle: 0.55, candleSpace: 0.55, elevator: 0.9, ant: 0.12, mirror: 1.0,
  router: 0.14, bird: 0.16, powerLine: 3.4, balloon: 1.15, paper: 0.05, aquarium: 0.42, headphones: 0.2,
  weighScale: 0.05, earthCut: 0, planet: 0, carGlass: 0.6, astronaut: 1.1, goal: 0.9,
};

const v3 = (a: number[] | null | undefined): Vec3 => [a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0];

export const propPositionAt = (p: PropSpec, frame: number, duration: number): Vec3 => {
  const base = v3(p.position);
  if (p.anim === 'slide' && p.slideTo) {
    const t = interpolate(frame, [0, duration * 0.85], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });
    const to = v3(p.slideTo);
    return [base[0] + (to[0] - base[0]) * t, base[1] + (to[1] - base[1]) * t, base[2] + (to[2] - base[2]) * t];
  }
  if (p.anim === 'bob') return [base[0], base[1] + Math.sin(frame * 0.09) * 0.15 * p.scale, base[2]];
  if (p.anim === 'shake') return [base[0] + Math.sin(frame * 0.7) * 0.025 * p.scale, base[1] + Math.abs(Math.sin(frame * 0.35)) * 0.02 * p.scale, base[2]];
  return base;
};

/** Bod pro štítky: sleduje jen plynulé posunutí (slide), ne chvění a pohupování. */
export const stableAnchorAt = (p: PropSpec, frame: number, duration: number): Vec3 => {
  const pos = p.anim === 'slide' ? propPositionAt(p, frame, duration) : v3(p.position);
  return [pos[0], pos[1] + ANCHOR_Y[p.type] * p.scale, pos[2]];
};

export const propAnchorAt = (p: PropSpec, frame: number, duration: number): Vec3 => {
  const pos = propPositionAt(p, frame, duration);
  return [pos[0], pos[1] + ANCHOR_Y[p.type] * p.scale, pos[2]];
};

const ANGLES: Record<CameraSpec['angle'], [number, number]> = {
  // [azimut, elevace] ve stupních; azimut 0 = kamera na +z
  front: [0, 14],
  frontLeft: [-35, 20],
  frontRight: [35, 20],
  side: [80, 12],
  top: [10, 62],
  low: [15, 4],
};

const fromSpherical = (focus: Vec3, dist: number, azDeg: number, elDeg: number): Vec3 => {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  return [
    focus[0] + dist * Math.cos(el) * Math.sin(az),
    focus[1] + dist * Math.sin(el),
    focus[2] + dist * Math.cos(el) * Math.cos(az),
  ];
};

/** Přibližný poloměr dílu kolem jeho středu (při scale 1) – pro automatické rámování. */
const RADIUS: Record<PropType, number> = {
  sun: 1.8, moon: 0.65, earth: 1.15, cloud: 1.5, tree: 1.5, mountain: 2.2, house: 1.6, car: 1.05, plane: 1.7,
  rocket: 1.3, boat: 1.3, hotAirBalloon: 1.9, ball: 0.42, magnet: 0.75, battery: 0.6, bulb: 0.55, phone: 0.55,
  pot: 0.72, stove: 0.8, fridge: 1.05, microwave: 0.58, cup: 0.36, iceCube: 0.36, waterPool: 2, person: 1.0,
  arrow: 0.7, arrowUp: 0.7, arrowDown: 0.7, windTurbine: 3, snowflake: 0.75, thermometer: 0.9, speaker: 0.6,
  satellite: 1.8, lightning: 1.4, solarPanel: 0.9, atom: 1.0, lens: 0.65, prism: 0.6, table: 1.2,
  banana: 0.5, clock: 0.55, cat: 0.55, candle: 0.5, candleSpace: 0.5, elevator: 1.1, ant: 0.3, mirror: 1.0,
  router: 0.35, bird: 0.25, powerLine: 3.2, balloon: 0.6, paper: 0.45, aquarium: 0.75, headphones: 0.3,
  weighScale: 0.4, earthCut: 2.1, planet: 1.05, carGlass: 1.05, astronaut: 1.0, goal: 1.6,
};
/** Kulisy – nemusí být v záběru celé. */
const BACKDROP = new Set<PropType>(['table', 'waterPool', 'mountain', 'house', 'tree', 'cloud', 'powerLine', 'goal']);

export type FitItem = {p: Vec3; r: number};

/** Co musí být v záběru vidět celé: všechny díly kromě kulis (u "slide" začátek i konec dráhy). */
export const fitItems = (props: PropSpec[], duration: number): FitItem[] =>
  props
    .filter((p) => !BACKDROP.has(p.type))
    .flatMap((p) => {
      const r = RADIUS[p.type] * p.scale;
      const items: FitItem[] = [{p: propAnchorAt(p, 0, duration), r}];
      if (p.anim === 'slide' && p.slideTo) items.push({p: propAnchorAt(p, duration, duration), r});
      return items;
    });

// Obraz je 9:16 a svislé FOV 45°: tan(22.5°) ≈ 0.414. Vodorovně je to × 9/16.
// Rezervy: vodorovně 84 % šířky, svisle 62 % výšky (nahoře nadpis + počítadlo, dole titulky).
const KX = 0.4142 * (9 / 16) * 0.84;
const KY = 0.4142 * 0.62;

/**
 * Z jednoduchého presetu (úhel + pohyb) udělá dráhu kamery.
 * Automatické rámování: cíl se posune k těžišti dílů a kamera ustoupí,
 * když by něco důležitého vyčnívalo z úzkého obrazu na výšku.
 */
export const shotFromSpec = (cam: CameraSpec, focusPoint: Vec3, items: FitItem[] = []): CameraShot => {
  const [az, el] = ANGLES[cam.angle] ?? ANGLES.front;
  let focus = focusPoint;
  if (items.length > 1) {
    const c = [0, 1, 2].map((k) => items.reduce((s, it) => s + it.p[k], 0) / items.length);
    focus = [0, 1, 2].map((k) => focusPoint[k] * 0.6 + c[k] * 0.4) as Vec3;
  }
  // báze kamery pro daný úhel
  const azr = (az * Math.PI) / 180;
  const elr = (el * Math.PI) / 180;
  const dir: Vec3 = [Math.cos(elr) * Math.sin(azr), Math.sin(elr), Math.cos(elr) * Math.cos(azr)];
  const right: Vec3 = [Math.cos(azr), 0, -Math.sin(azr)];
  const up: Vec3 = [
    dir[1] * right[2] - dir[2] * right[1],
    dir[2] * right[0] - dir[0] * right[2],
    dir[0] * right[1] - dir[1] * right[0],
  ];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let need = 0;
  for (const it of items) {
    const v: Vec3 = [it.p[0] - focus[0], it.p[1] - focus[1], it.p[2] - focus[2]];
    const x = Math.abs(dot(v, right)) + it.r;
    const y = Math.abs(dot(v, up)) + it.r;
    const z = dot(v, dir); // kladné = blíž ke kameře
    need = Math.max(need, x / KX + z, y / KY + z);
  }
  // nejbližší bod dráhy (dolly) je ~0.86 × vzdálenost; orbit mění úhel → malá rezerva
  const closest = cam.move === 'dollyIn' || cam.move === 'dollyOut' ? 0.86 : 0.94;
  const d = Math.max(1.5, Math.min(Math.max(cam.distance, need / closest), Math.max(cam.distance, 2) * 2.6));
  let a = {d: d * 1.04, az, el};
  let b = {d: d * 0.96, az, el};
  switch (cam.move) {
    case 'dollyIn':
      a = {d: d * 1.28, az, el};
      b = {d: d * 0.86, az, el};
      break;
    case 'dollyOut':
      a = {d: d * 0.86, az, el};
      b = {d: d * 1.22, az, el};
      break;
    case 'orbitLeft':
      a = {d, az: az + 18, el};
      b = {d, az: az - 18, el};
      break;
    case 'orbitRight':
      a = {d, az: az - 18, el};
      b = {d, az: az + 18, el};
      break;
    case 'rise':
      a = {d: d * 1.02, az, el: el - 8};
      b = {d: d * 0.98, az, el: el + 14};
      break;
  }
  return {
    from: {position: fromSpherical(focus, a.d, a.az, a.el), target: focus},
    to: {position: fromSpherical(focus, b.d, b.az, b.el), target: focus},
    fov: 45,
  };
};
