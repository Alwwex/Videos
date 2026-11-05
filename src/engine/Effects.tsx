import React, {useMemo} from 'react';
import {BufferGeometry, Color, Float32BufferAttribute, Object3D} from 'three';
import type {Vec3} from '../types';
import type {FlowSpec, WavesSpec} from './schema';
import {rand} from '../three/layout';
import {Halo} from './Halo';

const FLOW_STYLE: Record<FlowSpec['kind'], {c: string; size: number; shape: 'oct' | 'ico'}> = {
  photons: {c: '#ffd400', size: 0.12, shape: 'oct'},
  electrons: {c: '#4fd8ff', size: 0.08, shape: 'ico'},
  heat: {c: '#ff6a2a', size: 0.1, shape: 'ico'},
  cold: {c: '#9fe3ff', size: 0.1, shape: 'oct'},
  water: {c: '#3f9be0', size: 0.1, shape: 'ico'},
  air: {c: '#ffffff', size: 0.07, shape: 'ico'},
  sound: {c: '#c77dff', size: 0.09, shape: 'oct'},
  light: {c: '#fff3a0', size: 0.1, shape: 'oct'},
  microwaves: {c: '#ff4fa3', size: 0.09, shape: 'oct'},
};

const WAVE_COLOR: Record<WavesSpec['kind'], string> = {
  sound: '#c77dff',
  radio: '#4fd8ff',
  heat: '#ff6a2a',
  light: '#fff3a0',
  microwaves: '#ff4fa3',
};

const hdr = (c: string, k: number) => new Color(c).multiplyScalar(k);

const TRAIL = 4; // kolik "duchů" táhne každá částice za sebou

/** Proud částic z bodu A do bodu B po mírném oblouku, se stopou. */
export const Flow: React.FC<{kind: FlowSpec['kind']; a: Vec3; b: Vec3; frame: number; seed: number}> = ({kind, a, b, frame, seed}) => {
  const st = FLOW_STYLE[kind];
  const core = useMemo(() => hdr(st.c, 1), [st.c]);
  const soft = useMemo(() => hdr(st.c, 1), [st.c]);
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const ctrl: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + dist * 0.2, (a[2] + b[2]) / 2];
  const N = 10;
  const period = Math.max(26, dist * 10);
  const at = (t: number, i: number): Vec3 => {
    const u = 1 - t;
    // jemné vlnění kolmo na dráhu, ať to nejsou vojáci v řadě
    const wob = Math.sin(t * Math.PI) * 0.18;
    return [0, 1, 2].map(
      (k) => u * u * a[k] + 2 * u * t * ctrl[k] + t * t * b[k] + (rand(seed + i * 3 + k) - 0.5) * wob,
    ) as Vec3;
  };
  return (
    <group>
      {Array.from({length: N}).map((_, i) => {
        const t = (frame / period + i / N) % 1;
        // plynulé zrychlení na začátku a zpomalení u cíle
        const te = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        const fade = Math.min(1, t * 8, (1 - t) * 8);
        return (
          <group key={i}>
            <Halo color={st.c} size={st.size * 7 * fade} opacity={0.55} position={at(te, i)} />
            {Array.from({length: TRAIL}).map((__, k) => {
              const tk = Math.max(0, te - k * 0.022);
              const p = at(tk, i);
              const s = fade * (1 - k * 0.2) * (k === 0 ? 1 : 0.8);
              return (
                <mesh key={k} position={p} scale={s} rotation={[frame * 0.2 + i, frame * 0.15, 0]}>
                  {st.shape === 'oct' ? <octahedronGeometry args={[st.size, 0]} /> : <icosahedronGeometry args={[st.size, 1]} />}
                  <meshBasicMaterial
                    color={k === 0 ? core : soft}
                    toneMapped={false}
                    transparent={k > 0}
                    opacity={k === 0 ? 1 : 0.45 / k}
                    depthWrite={k === 0}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
};

const helper = new Object3D();

/** Rozpínající se vlny z jednoho bodu (zvuk, rádio, teplo…), vždy čelem ke kameře. */
export const Waves: React.FC<{kind: WavesSpec['kind']; at: Vec3; frame: number; camPos: Vec3}> = ({kind, at, frame, camPos}) => {
  const col = useMemo(() => hdr(WAVE_COLOR[kind], 1), [kind]);
  helper.position.set(...at);
  helper.lookAt(...camPos);
  const rot: [number, number, number] = [helper.rotation.x, helper.rotation.y, helper.rotation.z];
  return (
    <group position={at} rotation={rot}>
      {[0, 1, 2].map((i) => {
        const t = ((frame + i * 16) % 48) / 48;
        const e = 1 - (1 - t) ** 2.4; // rychlý start, měkký dojezd
        return (
          <mesh key={i} scale={0.35 + e * 1.55}>
            <torusGeometry args={[1, 0.03 * (1 - t * 0.5), 6, 48]} />
            <meshBasicMaterial color={col} toneMapped={false} transparent opacity={(1 - t) ** 1.4 * 0.9} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
};

export const Stars: React.FC<{frame?: number}> = ({frame = 0}) => {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 600; i++) {
      const th = rand(i) * Math.PI * 2;
      const ph = Math.acos(2 * rand(i + 999) - 1);
      const r = 40 + rand(i + 77) * 20;
      pts.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const col = useMemo(() => hdr('#ffffff', 1), []);
  return (
    <points geometry={geo} rotation={[0, frame * 0.0006, 0]}>
      <pointsMaterial color={col} size={0.28} sizeAttenuation toneMapped={false} />
    </points>
  );
};
