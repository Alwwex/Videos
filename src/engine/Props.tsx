import React, {useMemo} from 'react';
import {CanvasTexture, Color} from 'three';
import type {PropSpec, PropType} from './schema';
import {ANCHOR_Y, propPositionAt} from './anim';
import {Halo} from './Halo';

/* Knihovna low-poly dílů. Každý díl stojí na y=0 (pokud nelétá) a měří zhruba 0.5–3 m. */

type PP = {c: string | null; frame: number; glow: boolean; anim: PropSpec['anim']};
type V3 = [number, number, number];

const Std: React.FC<{c: string; e?: string; ei?: number; r?: number; m?: number; o?: number}> = ({c, e, ei = 0, r = 0.8, m = 0, o}) => (
  <meshStandardMaterial
    color={c}
    emissive={e ?? '#000000'}
    emissiveIntensity={ei}
    roughness={r}
    // bez env mapy vypadá kov černě – kovovost jen naznačíme
    metalness={m * 0.3}
    flatShading
    transparent={o !== undefined}
    opacity={o ?? 1}
  />
);

/** Svítící materiál (neovlivněný světlem). boost < 1 ztlumí, > 1 nemá efekt. */
const Glow: React.FC<{c: string; o?: number; boost?: number}> = ({c, o = 1, boost = 1}) => {
  const col = useMemo(() => new Color(c).multiplyScalar(Math.min(1, boost)), [c, boost]);
  return <meshBasicMaterial color={col} toneMapped={false} transparent={o < 1} opacity={o} depthWrite={o >= 1} />;
};

const Box: React.FC<{s: V3; p?: V3; r?: V3; children: React.ReactNode}> = ({s, p, r, children}) => (
  <mesh position={p} rotation={r} castShadow receiveShadow>
    <boxGeometry args={s} />
    {children}
  </mesh>
);
const Cyl: React.FC<{a: [number, number, number, number?]; p?: V3; r?: V3; children: React.ReactNode}> = ({a, p, r, children}) => (
  <mesh position={p} rotation={r} castShadow receiveShadow>
    <cylinderGeometry args={[a[0], a[1], a[2], a[3] ?? 8]} />
    {children}
  </mesh>
);
const Ico: React.FC<{rad: number; d?: number; p?: V3; s?: V3; children: React.ReactNode}> = ({rad, d = 0, p, s, children}) => (
  <mesh position={p} scale={s} castShadow receiveShadow>
    <icosahedronGeometry args={[rad, d]} />
    {children}
  </mesh>
);
const Ring: React.FC<{r: number; t: number; p?: V3; rot?: V3; children: React.ReactNode}> = ({r, t, p, rot, children}) => (
  <mesh position={p} rotation={rot} castShadow>
    <torusGeometry args={[r, t, 6, 20]} />
    {children}
  </mesh>
);

const PI = Math.PI;
const SKIN = '#f1c7a0';

/** Ruka otáčená kolem ramene, s dlaní na konci. */
const Arm: React.FC<{x: number; rz: number; rx?: number}> = ({x, rz, rx = 0}) => (
  <group position={[x, 1.36, 0]} rotation={[rx, 0, rz]}>
    <Cyl a={[0.065, 0.055, 0.55, 6]} p={[0, -0.27, 0]}><Std c="#ffb020" /></Cyl>
    <Ico rad={0.085} d={1} p={[0, -0.58, 0]}><Std c={SKIN} /></Ico>
  </group>
);

/** Postavička v šoku: ruce nahoru, otevřená pusa, vykulené oči, lehce se klepe. */
const ShockedPerson: React.FC<{c: string | null; frame: number}> = ({c, frame}) => {
  const j = Math.sin(frame * 1.7) * 0.012;
  const arm = 2.75 + Math.sin(frame * 0.5) * 0.12;
  return (
    <group position={[j, 0, 0]}>
      <Box s={[0.16, 0.08, 0.26]} p={[-0.12, 0.04, 0.04]}><Std c="#2a2a2a" /></Box>
      <Box s={[0.16, 0.08, 0.26]} p={[0.12, 0.04, 0.04]}><Std c="#2a2a2a" /></Box>
      <Cyl a={[0.08, 0.08, 0.66, 6]} p={[-0.12, 0.41, 0]}><Std c="#2f3b59" /></Cyl>
      <Cyl a={[0.08, 0.08, 0.66, 6]} p={[0.12, 0.41, 0]}><Std c="#2f3b59" /></Cyl>
      <Cyl a={[0.22, 0.27, 0.72, 10]} p={[0, 1.06, 0]}><Std c={c ?? '#ffb020'} /></Cyl>
      <Ico rad={0.22} d={1} p={[0, 1.4, 0]} s={[1, 0.45, 0.95]}><Std c={c ?? '#ffb020'} /></Ico>
      <Arm x={-0.26} rz={-arm} />
      <Arm x={0.26} rz={arm} />
      <Ico rad={0.23} d={1} p={[0, 1.68, 0]}><Std c={SKIN} /></Ico>
      <Ico rad={0.24} d={1} p={[0, 1.78, -0.04]} s={[1, 0.62, 1]}><Std c="#4a3020" /></Ico>
      {[-0.08, 0.08].map((x) => (
        <group key={x}>
          <Ico rad={0.055} d={1} p={[x, 1.72, 0.2]}><Std c="#ffffff" r={0.3} /></Ico>
          <Ico rad={0.028} d={1} p={[x, 1.72, 0.25]}><Std c="#1a1010" r={0.3} /></Ico>
          <Box s={[0.09, 0.02, 0.02]} p={[x, 1.83, 0.2]} r={[0, 0, x > 0 ? -0.35 : 0.35]}><Std c="#3a2416" /></Box>
        </group>
      ))}
      <Ico rad={0.05} d={1} p={[0, 1.58, 0.21]} s={[0.9, 1.2, 0.5]}><Std c="#5a1e16" /></Ico>
    </group>
  );
};

const LIB: Record<PropType, React.FC<PP>> = {
  sun: ({frame}) => (
    <group rotation={[0, frame * 0.01, 0]}>
      <mesh><icosahedronGeometry args={[1.2, 1]} /><Glow c="#ffd54a" boost={2.4} /></mesh>
      <mesh scale={1.45 + Math.sin(frame * 0.12) * 0.05}><icosahedronGeometry args={[1.2, 0]} /><Glow c="#ffb347" o={0.3} boost={1.4} /></mesh>
      <Halo color="#ffc94a" size={8 + Math.sin(frame * 0.1) * 0.3} opacity={0.75} />
      <Halo color="#fff1b0" size={3.6} opacity={0.6} />
    </group>
  ),
  moon: ({c}) => (
    <group>
      <Ico rad={0.6} d={1}><Std c={c ?? '#d8d4cc'} /></Ico>
      <Ico rad={0.14} p={[0.25, 0.2, 0.47]} s={[1, 1, 0.3]}><Std c="#b9b4aa" /></Ico>
      <Ico rad={0.1} p={[-0.2, -0.15, 0.52]} s={[1, 1, 0.3]}><Std c="#b9b4aa" /></Ico>
    </group>
  ),
  earth: ({frame, c}) => (
    <group rotation={[0.4, frame * 0.012, 0]}>
      <Ico rad={1} d={1}><Std c={c ?? '#3f8ee0'} r={0.6} /></Ico>
      {[[0.6, 0.5, 0.55], [-0.7, 0.1, 0.65], [0.1, -0.6, 0.8], [0.2, 0.75, -0.6], [-0.4, -0.3, -0.85]].map((p, i) => (
        <Ico key={i} rad={0.32} p={p as V3} s={[1, 0.5, 1]}><Std c="#5fbf5a" /></Ico>
      ))}
      <mesh scale={1.08}><icosahedronGeometry args={[1, 1]} /><meshBasicMaterial color="#9fd8ff" transparent opacity={0.18} depthWrite={false} /></mesh>
    </group>
  ),
  cloud: ({c, frame}) => (
    <group position={[Math.sin(frame * 0.02) * 0.1, 0, 0]}>
      {[[0, 0, 0, 1], [0.9, -0.15, 0.1, 0.75], [-0.9, -0.2, 0, 0.7], [0.3, 0.45, -0.1, 0.65]].map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} scale={s}><icosahedronGeometry args={[0.8, 1]} /><Std c={c ?? '#fff6ea'} e="#ffe8cc" ei={0.45} r={1} /></mesh>
      ))}
    </group>
  ),
  tree: ({c, frame}) => (
    <group rotation={[0, 0, Math.sin(frame * 0.05) * 0.015]}>
      <Cyl a={[0.12, 0.18, 1, 6]} p={[0, 0.5, 0]}><Std c="#8a5a3b" /></Cyl>
      <mesh position={[0, 1.5, 0]} castShadow><coneGeometry args={[0.95, 1.6, 7]} /><Std c={c ?? '#4f9a4a'} /></mesh>
      <mesh position={[0, 2.35, 0]} castShadow><coneGeometry args={[0.7, 1.3, 7]} /><Std c={c ?? '#62b257'} /></mesh>
    </group>
  ),
  mountain: ({c}) => (
    <group>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow><coneGeometry args={[2.2, 3, 7]} /><Std c={c ?? '#8d8a7e'} /></mesh>
      <mesh position={[0, 2.55, 0]}><coneGeometry args={[0.82, 0.92, 7]} /><Std c="#ffffff" /></mesh>
      <mesh position={[1.4, 0.8, 0.4]} castShadow><coneGeometry args={[1.1, 1.6, 6]} /><Std c="#7d7a6f" /></mesh>
    </group>
  ),
  house: ({c, glow}) => (
    <group>
      <Box s={[2, 1.5, 1.6]} p={[0, 0.75, 0]}><Std c={c ?? '#f3e1c4'} /></Box>
      <Cyl a={[1.25, 1.25, 2.3, 3]} p={[0, 1.85, 0]} r={[0, 0, PI / 2]}><Std c="#c8553d" /></Cyl>
      <Box s={[0.3, 0.6, 0.3]} p={[0.6, 2.35, -0.3]}><Std c="#a8513a" /></Box>
      <Box s={[0.45, 0.8, 0.05]} p={[-0.45, 0.4, 0.81]}><Std c="#9c5634" /></Box>
      <Ico rad={0.035} p={[-0.3, 0.42, 0.85]}><Std c="#ffd54a" m={1} /></Ico>
      <Box s={[0.56, 0.5, 0.04]} p={[0.45, 0.9, 0.81]}><Std c="#ffffff" /></Box>
      <Box s={[0.48, 0.42, 0.05]} p={[0.45, 0.9, 0.82]}><Std c={glow ? '#ffe9a8' : '#7fb6d9'} e="#ffcc55" ei={glow ? 1.6 : 0} r={0.2} /></Box>
    </group>
  ),
  car: ({c, frame}) => (
    <group>
      <Box s={[1.9, 0.5, 0.95]} p={[0, 0.45, 0]}><Std c={c ?? '#e2483d'} r={0.45} /></Box>
      <Box s={[1.05, 0.42, 0.86]} p={[-0.1, 0.9, 0]}><Std c={c ?? '#e2483d'} r={0.45} /></Box>
      <Box s={[1.07, 0.3, 0.8]} p={[-0.1, 0.92, 0]}><Std c="#2d4a66" r={0.2} /></Box>
      <Box s={[0.06, 0.12, 0.22]} p={[0.96, 0.5, 0.3]}><Glow c="#fff2b0" boost={1.6} /></Box>
      <Box s={[0.06, 0.12, 0.22]} p={[0.96, 0.5, -0.3]}><Glow c="#fff2b0" boost={1.6} /></Box>
      <Halo color="#fff2b0" size={0.6} opacity={0.6} position={[1.0, 0.5, 0.3]} />
      <Halo color="#fff2b0" size={0.6} opacity={0.6} position={[1.0, 0.5, -0.3]} />
      <Box s={[0.05, 0.1, 0.18]} p={[-0.96, 0.52, 0.32]}><Glow c="#ff3b30" boost={1.4} /></Box>
      <Box s={[0.05, 0.1, 0.18]} p={[-0.96, 0.52, -0.32]}><Glow c="#ff3b30" boost={1.4} /></Box>
      {[[-0.6, 0.5], [0.6, 0.5], [-0.6, -0.5], [0.6, -0.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0.22, z]} rotation={[PI / 2, 0, 0]}>
          <group rotation={[0, frame * 0.3, 0]}>
            <Cyl a={[0.22, 0.22, 0.15, 10]}><Std c="#2a2a2a" /></Cyl>
            <Cyl a={[0.11, 0.11, 0.16, 6]}><Std c="#c9ccd2" m={1} /></Cyl>
          </group>
        </group>
      ))}
    </group>
  ),
  plane: ({c}) => (
    <group>
      <Cyl a={[0.22, 0.28, 3, 10]} r={[0, 0, PI / 2]}><Std c={c ?? '#f2f4f7'} /></Cyl>
      <mesh position={[1.65, 0, 0]} rotation={[0, 0, -PI / 2]}><coneGeometry args={[0.22, 0.4, 10]} /><Std c={c ?? '#f2f4f7'} /></mesh>
      <Box s={[0.7, 0.06, 3]} p={[0.1, 0, 0]}><Std c="#4a7bd1" /></Box>
      <Box s={[0.4, 0.6, 0.06]} p={[-1.35, 0.35, 0]}><Std c="#4a7bd1" /></Box>
      <Box s={[0.35, 0.05, 1]} p={[-1.35, 0.05, 0]}><Std c="#4a7bd1" /></Box>
      {[-0.6, -0.2, 0.2, 0.6, 1].map((x) => (
        <Box key={x} s={[0.12, 0.1, 0.02]} p={[x, 0.08, 0.27]}><Std c="#2d4a66" r={0.2} /></Box>
      ))}
    </group>
  ),
  rocket: ({c, frame}) => (
    <group>
      <Cyl a={[0.3, 0.3, 1.6, 10]} p={[0, 1.1, 0]}><Std c={c ?? '#f2f4f7'} /></Cyl>
      <mesh position={[0, 2.2, 0]} castShadow><coneGeometry args={[0.3, 0.6, 10]} /><Std c="#e2483d" /></mesh>
      <Cyl a={[0.12, 0.12, 0.05, 12]} p={[0, 1.45, 0.29]} r={[PI / 2, 0, 0]}><Std c="#7fd3ff" e="#4fb8ff" ei={0.4} r={0.2} /></Cyl>
      <Ring r={0.12} t={0.025} p={[0, 1.45, 0.31]}><Std c="#c9ccd2" m={1} /></Ring>
      {[0, 1, 2].map((i) => (
        <Box key={i} s={[0.05, 0.5, 0.35]} p={[Math.sin((i * 2 * PI) / 3) * 0.32, 0.45, Math.cos((i * 2 * PI) / 3) * 0.32]} r={[0, (i * 2 * PI) / 3, 0]}><Std c="#e2483d" /></Box>
      ))}
      <mesh position={[0, 0.02, 0]} rotation={[PI, 0, 0]} scale={[1, 1 + Math.sin(frame * 0.9) * 0.2, 1]}>
        <coneGeometry args={[0.22, 0.8, 10]} />
        <Glow c="#ff8a1e" boost={2.6} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[PI, 0, 0]} scale={[1, 1 + Math.sin(frame * 1.3) * 0.25, 1]}>
        <coneGeometry args={[0.11, 0.5, 8]} />
        <Glow c="#fff3a0" boost={3} />
      </mesh>
      <Halo color="#ff9a2e" size={1.8 + Math.sin(frame * 0.9) * 0.2} opacity={0.85} position={[0, -0.2, 0]} />
    </group>
  ),
  boat: ({c, frame}) => (
    <group rotation={[Math.sin(frame * 0.06) * 0.04, 0, Math.sin(frame * 0.05) * 0.03]}>
      <Cyl a={[1.2, 0.8, 0.5, 4]} p={[0, 0.25, 0]} r={[0, PI / 4, 0]}><Std c={c ?? '#b5653b'} /></Cyl>
      <Box s={[0.7, 0.5, 0.6]} p={[-0.2, 0.75, 0]}><Std c="#f3e1c4" /></Box>
      <Box s={[0.5, 0.15, 0.62]} p={[-0.2, 0.85, 0]}><Std c="#7fb6d9" r={0.2} /></Box>
      <Cyl a={[0.04, 0.04, 1.6, 5]} p={[0.4, 1.3, 0]}><Std c="#8a5a3b" /></Cyl>
      <mesh position={[0.65, 1.3, 0]} rotation={[0, PI / 2, 0]}><coneGeometry args={[0.45, 1.2, 3]} /><Std c="#ffffff" /></mesh>
    </group>
  ),
  hotAirBalloon: ({c, frame}) => (
    <group rotation={[0, 0, Math.sin(frame * 0.04) * 0.03]}>
      <Ico rad={1} d={1} p={[0, 2.3, 0]} s={[1, 1.15, 1]}><Std c={c ?? '#ff7a45'} /></Ico>
      <Ring r={0.86} t={0.06} p={[0, 2.3, 0]} rot={[PI / 2, 0, 0]}><Std c="#ffd43b" /></Ring>
      <Box s={[0.5, 0.4, 0.5]} p={[0, 0.2, 0]}><Std c="#a8743f" /></Box>
      {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z], i) => (
        <Cyl key={i} a={[0.015, 0.015, 1.1, 4]} p={[x * 1.6, 0.9, z * 1.6]}><Std c="#5a4630" /></Cyl>
      ))}
      <mesh position={[0, 0.75, 0]} scale={1 + Math.sin(frame * 0.7) * 0.15}><coneGeometry args={[0.08, 0.25, 6]} /><Glow c="#ff9a2e" boost={2.6} /></mesh>
      <Halo color="#ff9a2e" size={0.9} opacity={0.8} position={[0, 0.78, 0]} />
    </group>
  ),
  ball: ({c}) => (
    <group>
      <Ico rad={0.4} d={1} p={[0, 0.4, 0]}><Std c={c ?? '#ff5d8f'} r={0.5} /></Ico>
      <Ring r={0.4} t={0.03} p={[0, 0.4, 0]} rot={[0.4, 0, 0]}><Std c="#ffffff" /></Ring>
    </group>
  ),
  magnet: ({c}) => (
    <group>
      <Box s={[0.3, 0.8, 0.3]} p={[-0.35, 0.8, 0]}><Std c={c ?? '#e2483d'} /></Box>
      <Box s={[0.3, 0.8, 0.3]} p={[0.35, 0.8, 0]}><Std c="#3f7be0" /></Box>
      <Box s={[0.31, 0.18, 0.31]} p={[-0.35, 1.25, 0]}><Std c="#d9dde3" m={1} /></Box>
      <Box s={[0.31, 0.18, 0.31]} p={[0.35, 1.25, 0]}><Std c="#d9dde3" m={1} /></Box>
      <Box s={[1, 0.3, 0.3]} p={[0, 0.25, 0]}><Std c="#8a8f99" m={0.5} /></Box>
    </group>
  ),
  battery: ({c}) => (
    <group>
      <Cyl a={[0.3, 0.3, 1, 12]} p={[0, 0.5, 0]}><Std c={c ?? '#2b2f36'} r={0.4} /></Cyl>
      <Cyl a={[0.305, 0.305, 0.32, 12]} p={[0, 0.84, 0]}><Std c="#ffb020" r={0.4} /></Cyl>
      <Cyl a={[0.1, 0.1, 0.1, 8]} p={[0, 1.05, 0]}><Std c="#c9ccd2" m={1} /></Cyl>
      <Box s={[0.14, 0.035, 0.02]} p={[0, 0.84, 0.31]}><Std c="#2b2f36" /></Box>
      <Box s={[0.035, 0.14, 0.02]} p={[0, 0.84, 0.31]}><Std c="#2b2f36" /></Box>
    </group>
  ),
  bulb: ({c, glow, frame}) => (
    <group>
      <Cyl a={[0.16, 0.18, 0.32, 10]} p={[0, 0.18, 0]}><Std c="#a8acb3" m={1} /></Cyl>
      {[0.1, 0.2, 0.3].map((y) => (
        <Ring key={y} r={0.175} t={0.018} p={[0, y, 0]} rot={[PI / 2, 0, 0]}><Std c="#c9ccd2" m={1} /></Ring>
      ))}
      <Ico rad={0.38} d={2} p={[0, 0.7, 0]}>
        {glow ? <Glow c={c ?? '#fff2a8'} boost={2.4} /> : <Std c="#e8f2f7" r={0.15} o={0.75} />}
      </Ico>
      {!glow ? <Ring r={0.08} t={0.012} p={[0, 0.68, 0]}><Std c="#8a8f99" /></Ring> : null}
      {glow ? <mesh position={[0, 0.7, 0]} scale={1.55 + Math.sin(frame * 0.2) * 0.08}><icosahedronGeometry args={[0.38, 1]} /><Glow c="#ffd54a" o={0.22} boost={1.3} /></mesh> : null}
      {glow ? <pointLight position={[0, 0.7, 0]} color="#ffcc66" intensity={3} distance={5} /> : null}
      {glow ? <Halo color="#ffd77a" size={2.6 + Math.sin(frame * 0.2) * 0.15} opacity={0.8} position={[0, 0.7, 0]} /> : null}
    </group>
  ),
  phone: ({c, glow}) => (
    <group>
      <Box s={[0.55, 1, 0.07]} p={[0, 0.5, 0]}><Std c={c ?? '#23262d'} r={0.3} /></Box>
      <Box s={[0.48, 0.88, 0.01]} p={[0, 0.5, 0.04]}><Std c="#3a7bff" e="#3a7bff" ei={glow ? 1.4 : 0.5} r={0.2} /></Box>
      {[0.75, 0.6, 0.45].map((y, i) => (
        <Box key={y} s={[0.36 - i * 0.08, 0.06, 0.012]} p={[-0.04 * i, y, 0.046]}><Std c="#ffffff" e="#ffffff" ei={0.5} /></Box>
      ))}
      <Cyl a={[0.025, 0.025, 0.02, 8]} p={[0, 0.97, 0.04]} r={[PI / 2, 0, 0]}><Std c="#111111" /></Cyl>
    </group>
  ),
  pot: ({c, glow}) => (
    <group>
      <Cyl a={[0.55, 0.5, 0.6, 14]} p={[0, 0.3, 0]}><Std c={c ?? '#a9afb7'} m={1} r={0.35} /></Cyl>
      <Ring r={0.55} t={0.035} p={[0, 0.6, 0]} rot={[PI / 2, 0, 0]}><Std c="#c9ccd2" m={1} /></Ring>
      <Cyl a={[0.56, 0.5, 0.06, 14]} p={[0, 0.64, 0]}><Std c="#8f959e" m={1} /></Cyl>
      <Cyl a={[0.06, 0.08, 0.1, 8]} p={[0, 0.72, 0]}><Std c="#2a2a2a" /></Cyl>
      <Box s={[0.22, 0.07, 0.12]} p={[0.64, 0.5, 0]}><Std c="#2a2a2a" /></Box>
      <Box s={[0.22, 0.07, 0.12]} p={[-0.64, 0.5, 0]}><Std c="#2a2a2a" /></Box>
      {glow ? <Cyl a={[0.5, 0.5, 0.02, 14]} p={[0, 0.01, 0]}><Glow c="#ff5a1c" boost={1.8} /></Cyl> : null}
    </group>
  ),
  stove: ({c, glow, frame}) => (
    <group>
      <Box s={[1.2, 0.88, 0.8]} p={[0, 0.44, 0]}><Std c={c ?? '#eef0f2'} r={0.5} /></Box>
      <Box s={[1.22, 0.04, 0.82]} p={[0, 0.9, 0]}><Std c="#1d1f24" r={0.15} /></Box>
      {[[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.18], [0.3, 0.18]].map(([x, z], i) => (
        <Ring key={i} r={0.13} t={0.022} p={[x, 0.925, z]} rot={[PI / 2, 0, 0]}>
          {glow ? <Glow c="#ff4a1c" boost={1.6 + Math.sin(frame * 0.2 + i) * 0.3} /> : <Std c="#3a3d44" />}
        </Ring>
      ))}
      {glow
        ? [[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.18], [0.3, 0.18]].map(([x, z], i) => (
            <Halo key={`h${i}`} color="#ff5a1c" size={0.8 + Math.sin(frame * 0.2 + i) * 0.08} opacity={0.65} position={[x, 0.95, z]} />
          ))
        : null}
      <Box s={[0.9, 0.42, 0.02]} p={[0, 0.38, 0.405]}><Std c="#2c3440" r={0.2} /></Box>
      <Box s={[0.7, 0.04, 0.05]} p={[0, 0.65, 0.43]}><Std c="#b8bdc4" m={1} /></Box>
      {[-0.42, -0.14, 0.14, 0.42].map((x) => (
        <Cyl key={x} a={[0.045, 0.045, 0.05, 8]} p={[x, 0.78, 0.42]} r={[PI / 2, 0, 0]}><Std c="#2a2a2a" /></Cyl>
      ))}
    </group>
  ),
  fridge: ({c}) => (
    <group>
      <Box s={[0.9, 2, 0.8]} p={[0, 1, 0]}><Std c={c ?? '#f4f6f8'} r={0.4} /></Box>
      <Box s={[0.9, 0.025, 0.81]} p={[0, 1.3, 0.005]}><Std c="#b8bdc4" /></Box>
      <Box s={[0.05, 0.4, 0.06]} p={[0.35, 1.6, 0.43]}><Std c="#9aa0a8" m={1} /></Box>
      <Box s={[0.05, 0.6, 0.06]} p={[0.35, 0.8, 0.43]}><Std c="#9aa0a8" m={1} /></Box>
      <Box s={[0.12, 0.12, 0.02]} p={[-0.2, 1.7, 0.405]}><Std c="#ff6b8b" /></Box>
      <Box s={[0.1, 0.14, 0.02]} p={[-0.05, 1.55, 0.405]}><Std c="#4fd8ff" /></Box>
      {[-0.35, 0.35].map((x) => <Box key={x} s={[0.08, 0.05, 0.08]} p={[x, 0.025, 0.3]}><Std c="#2a2a2a" /></Box>)}
    </group>
  ),
  microwave: ({c, glow, frame}) => (
    <group>
      <Box s={[1, 0.6, 0.7]} p={[0, 0.32, 0]}><Std c={c ?? '#e9ebee'} r={0.45} /></Box>
      {/* dvířka se sklem */}
      <Box s={[0.7, 0.5, 0.02]} p={[-0.11, 0.32, 0.355]}><Std c="#cfd3d9" /></Box>
      <Box s={[0.58, 0.38, 0.02]} p={[-0.13, 0.32, 0.365]}><Std c="#2c3440" e="#ffcf6a" ei={glow ? 1.4 : 0.04} r={0.15} /></Box>
      <Box s={[0.04, 0.4, 0.05]} p={[0.2, 0.32, 0.38]}><Std c="#9aa0a8" m={1} /></Box>
      {/* ovládací panel */}
      <Box s={[0.2, 0.08, 0.01]} p={[0.36, 0.5, 0.356]}><Std c="#10241a" e="#3dff8a" ei={0.9} /></Box>
      {[0.4, 0.32, 0.24].flatMap((y) =>
        [0.31, 0.41].map((x) => <Box key={`${x}${y}`} s={[0.06, 0.05, 0.015]} p={[x, y, 0.358]}><Std c="#a8adb5" /></Box>),
      )}
      <Cyl a={[0.035, 0.035, 0.03, 10]} p={[0.36, 0.13, 0.36]} r={[PI / 2, 0, 0]}><Std c="#59606b" /></Cyl>
      {[[-0.4, -0.28], [0.4, -0.28], [-0.4, 0.28], [0.4, 0.28]].map(([x, z]) => (
        <Cyl key={`${x}${z}`} a={[0.03, 0.03, 0.03, 6]} p={[x, 0.015, z]}><Std c="#2a2a2a" /></Cyl>
      ))}
      {glow ? <pointLight position={[-0.13, 0.32, 0.6]} color="#ffcc66" intensity={1.6} distance={2.2} /> : null}
      {glow ? <Halo color="#ffcf6a" size={1.3} opacity={0.45} position={[-0.13, 0.32, 0.45]} /> : null}
      {glow ? <Box s={[0.58, 0.02, 0.02]} p={[-0.13, 0.15 + ((frame * 0.01) % 0.34), 0.372]}><Glow c="#ffe9a8" o={0.4} boost={1.6} /></Box> : null}
    </group>
  ),
  cup: ({c}) => (
    <group>
      <Cyl a={[0.25, 0.2, 0.45, 12]} p={[0, 0.225, 0]}><Std c={c ?? '#ffffff'} r={0.35} /></Cyl>
      <Cyl a={[0.22, 0.22, 0.02, 12]} p={[0, 0.42, 0]}><Std c="#7a4a2a" r={0.2} /></Cyl>
      <mesh position={[0.28, 0.25, 0]}><torusGeometry args={[0.1, 0.03, 6, 12]} /><Std c={c ?? '#ffffff'} /></mesh>
      <Ring r={0.25} t={0.015} p={[0, 0.445, 0]} rot={[PI / 2, 0, 0]}><Std c={c ?? '#ffffff'} /></Ring>
    </group>
  ),
  iceCube: ({c, frame}) => (
    <group rotation={[0, Math.sin(frame * 0.03) * 0.1, 0]}>
      <Box s={[0.5, 0.5, 0.5]} p={[0, 0.25, 0]}><Std c={c ?? '#bfe9ff'} r={0.05} o={0.75} /></Box>
      <Box s={[0.06, 0.3, 0.02]} p={[-0.12, 0.3, 0.255]} r={[0, 0, 0.3]}><Glow c="#ffffff" o={0.7} boost={1.3} /></Box>
    </group>
  ),
  waterPool: ({c, frame}) => (
    <group>
      <Box s={[4, 0.2, 3]} p={[0, 0.1 + Math.sin(frame * 0.1) * 0.02, 0]}><Std c={c ?? '#3f9be0'} r={0.1} o={0.85} /></Box>
      {[-1.2, 0, 1.2].map((x, i) => (
        <Box key={x} s={[0.6, 0.01, 0.05]} p={[x + Math.sin(frame * 0.05 + i) * 0.2, 0.215, -0.6 + i * 0.6]}><Glow c="#ffffff" o={0.5} boost={1.2} /></Box>
      ))}
    </group>
  ),
  person: ({c, frame, anim}) => {
    const rubbing = anim === 'shake';
    if (anim === 'shock') return <ShockedPerson c={c} frame={frame} />;
    return (
      <group>
        {/* boty a nohy */}
        <Box s={[0.16, 0.08, 0.26]} p={[-0.12, 0.04, 0.04]}><Std c="#2a2a2a" /></Box>
        <Box s={[0.16, 0.08, 0.26]} p={[0.12, 0.04, 0.04]}><Std c="#2a2a2a" /></Box>
        <Cyl a={[0.08, 0.08, 0.66, 6]} p={[-0.12, 0.41, 0]}><Std c="#2f3b59" /></Cyl>
        <Cyl a={[0.08, 0.08, 0.66, 6]} p={[0.12, 0.41, 0]}><Std c="#2f3b59" /></Cyl>
        {/* tělo */}
        <Cyl a={[0.22, 0.27, 0.72, 10]} p={[0, 1.06, 0]}><Std c={c ?? '#ffb020'} /></Cyl>
        <Ico rad={0.22} d={1} p={[0, 1.4, 0]} s={[1, 0.45, 0.95]}><Std c={c ?? '#ffb020'} /></Ico>
        {/* ruce: mnutí rukou při "shake", jinak mávání */}
        {rubbing ? (
          <>
            <Arm x={-0.26} rz={0.35} rx={-1.1 + Math.sin(frame * 0.5) * 0.08} />
            <Arm x={0.26} rz={-0.35} rx={-1.1 - Math.sin(frame * 0.5) * 0.08} />
          </>
        ) : (
          <>
            <Arm x={-0.26} rz={-0.16 - Math.sin(frame * 0.06) * 0.04} />
            <Arm x={0.26} rz={2.55 + Math.sin(frame * 0.16) * 0.28} />
          </>
        )}
        {/* hlava */}
        <Ico rad={0.23} d={1} p={[0, 1.68, 0]}><Std c={SKIN} /></Ico>
        <Ico rad={0.24} d={1} p={[0, 1.78, -0.04]} s={[1, 0.62, 1]}><Std c="#4a3020" /></Ico>
        <Ico rad={0.038} d={1} p={[-0.08, 1.71, 0.205]}><Std c="#2a1a10" r={0.3} /></Ico>
        <Ico rad={0.038} d={1} p={[0.08, 1.71, 0.205]}><Std c="#2a1a10" r={0.3} /></Ico>
        <Ico rad={0.012} p={[-0.07, 1.725, 0.24]}><Glow c="#ffffff" boost={1} /></Ico>
        <Ico rad={0.012} p={[0.09, 1.725, 0.24]}><Glow c="#ffffff" boost={1} /></Ico>
        <mesh position={[0, 1.61, 0.205]} rotation={[0, 0, PI]}>
          <torusGeometry args={[0.055, 0.012, 4, 10, PI]} />
          <Std c="#7a2e22" />
        </mesh>
        <Ico rad={0.035} p={[-0.14, 1.64, 0.18]}><Std c="#ff9a8a" /></Ico>
        <Ico rad={0.035} p={[0.14, 1.64, 0.18]}><Std c="#ff9a8a" /></Ico>
      </group>
    );
  },
  arrow: ({c, frame}) => <Arrow c={c ?? '#e2483d'} frame={frame} rot={0} />,
  arrowUp: ({c, frame}) => <Arrow c={c ?? '#2fbf71'} frame={frame} rot={PI / 2} />,
  arrowDown: ({c, frame}) => <Arrow c={c ?? '#3f7be0'} frame={frame} rot={-PI / 2} />,
  windTurbine: ({c, frame}) => (
    <group>
      <Cyl a={[0.07, 0.14, 4, 8]} p={[0, 2, 0]}><Std c={c ?? '#f4f6f8'} /></Cyl>
      <Box s={[0.25, 0.25, 0.5]} p={[0, 4.05, 0]}><Std c="#f4f6f8" /></Box>
      <group position={[0, 4.05, 0.3]} rotation={[0, 0, frame * 0.08]}>
        <Ico rad={0.12} d={1}><Std c="#e2e5ea" /></Ico>
        {[0, 1, 2].map((i) => (
          <Box key={i} s={[0.12, 1.6, 0.04]} p={[Math.sin((i * 2 * PI) / 3) * 0.8, Math.cos((i * 2 * PI) / 3) * 0.8, 0]} r={[0, 0, -(i * 2 * PI) / 3]}>
            <Std c="#ffffff" />
          </Box>
        ))}
      </group>
    </group>
  ),
  snowflake: ({c, frame}) => (
    <group rotation={[0, 0, frame * 0.02]}>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, 0, (i * PI) / 3]}>
          <Box s={[1.4, 0.08, 0.05]}><Std c={c ?? '#dff4ff'} e="#bfe9ff" ei={0.6} /></Box>
          {[-0.45, 0.45].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <Box s={[0.25, 0.05, 0.04]} r={[0, 0, 0.8]}><Std c={c ?? '#dff4ff'} e="#bfe9ff" ei={0.6} /></Box>
              <Box s={[0.25, 0.05, 0.04]} r={[0, 0, -0.8]}><Std c={c ?? '#dff4ff'} e="#bfe9ff" ei={0.6} /></Box>
            </group>
          ))}
        </group>
      ))}
    </group>
  ),
  thermometer: ({c, frame}) => (
    <group>
      <Cyl a={[0.1, 0.1, 1.5, 10]} p={[0, 0.95, 0]}><Std c="#e8f2f7" r={0.1} o={0.55} /></Cyl>
      <Cyl a={[0.05, 0.05, 0.8 + Math.sin(frame * 0.05) * 0.1, 8]} p={[0, 0.6, 0]}><Glow c={c ?? '#ff3b30'} boost={1.5} /></Cyl>
      <Ico rad={0.18} d={1} p={[0, 0.2, 0]}><Glow c={c ?? '#ff3b30'} boost={1.5} /></Ico>
      <Halo color={c ?? '#ff3b30'} size={0.7} opacity={0.4} position={[0, 0.2, 0]} />
      {[0.6, 0.8, 1, 1.2, 1.4].map((y) => <Box key={y} s={[0.08, 0.015, 0.01]} p={[0.11, y, 0.05]}><Std c="#2b2f36" /></Box>)}
    </group>
  ),
  speaker: ({c, frame}) => (
    <group>
      <Box s={[0.7, 1, 0.6]} p={[0, 0.5, 0]}><Std c={c ?? '#2b2f36'} /></Box>
      <Cyl a={[0.24, 0.24, 0.04, 14]} p={[0, 0.38, 0.31]} r={[PI / 2, 0, 0]}><Std c="#59606b" /></Cyl>
      <Cyl a={[0.1, 0.1, 0.08 + Math.abs(Math.sin(frame * 0.6)) * 0.06, 10]} p={[0, 0.38, 0.34]} r={[PI / 2, 0, 0]}><Std c="#9aa0a8" /></Cyl>
      <Cyl a={[0.1, 0.1, 0.04, 10]} p={[0, 0.78, 0.31]} r={[PI / 2, 0, 0]}><Std c="#59606b" /></Cyl>
      <Ico rad={0.025} p={[0.25, 0.92, 0.31]}><Glow c="#3dff8a" boost={1.8} /></Ico>
    </group>
  ),
  satellite: ({c, frame}) => (
    <group rotation={[0, frame * 0.008, 0]}>
      <Box s={[0.6, 0.6, 0.6]}><Std c={c ?? '#d9b44a'} m={1} r={0.4} /></Box>
      <Box s={[1.4, 0.03, 0.5]} p={[-1.05, 0, 0]}><Std c="#1d3f94" e="#3a7bff" ei={0.25} /></Box>
      <Box s={[1.4, 0.03, 0.5]} p={[1.05, 0, 0]}><Std c="#1d3f94" e="#3a7bff" ei={0.25} /></Box>
      <mesh position={[0, 0.45, 0]}><coneGeometry args={[0.2, 0.25, 10]} /><Std c="#eef0f2" /></mesh>
      <Ico rad={0.03} p={[0, 0.6, 0]}><Glow c={Math.floor(frame / 15) % 2 ? '#ff3b30' : '#3a1010'} boost={2} /></Ico>
    </group>
  ),
  lightning: ({c, frame}) => (
    <group scale={Math.floor(frame / 4) % 3 === 0 ? 1.06 : 1}>
      <Box s={[0.18, 1.2, 0.1]} p={[0.1, 0.9, 0]} r={[0, 0, -0.35]}><Glow c={c ?? '#fff06a'} boost={2.6} /></Box>
      <Box s={[0.6, 0.15, 0.1]} p={[0, 0.25, 0]} r={[0, 0, 0.2]}><Glow c={c ?? '#fff06a'} boost={2.6} /></Box>
      <Box s={[0.18, 1.2, 0.1]} p={[-0.1, -0.4, 0]} r={[0, 0, -0.35]}><Glow c={c ?? '#fff06a'} boost={2.6} /></Box>
      <Halo color={c ?? '#fff06a'} size={3.2} opacity={Math.floor(frame / 4) % 3 === 0 ? 0.9 : 0.6} position={[0, 0.25, 0]} />
    </group>
  ),
  solarPanel: ({c, glow}) => (
    <group>
      <Cyl a={[0.05, 0.05, 0.6, 6]} p={[0, 0.3, 0]}><Std c="#9aa0a8" m={1} /></Cyl>
      <group position={[0, 0.7, 0]} rotation={[-0.6, 0, 0]}>
        <Box s={[1.6, 0.06, 1]}><Std c="#d9dde3" m={1} /></Box>
        <Box s={[1.5, 0.02, 0.9]} p={[0, 0.04, 0]}><Std c={c ?? '#1d3f94'} e="#3a7bff" ei={glow ? 0.6 : 0.05} r={0.25} /></Box>
        {[-0.5, -0.17, 0.17, 0.5].map((x) => <Box key={x} s={[0.012, 0.005, 0.9]} p={[x, 0.052, 0]}><Std c="#8fb3ff" /></Box>)}
        {[-0.15, 0.15].map((z) => <Box key={z} s={[1.5, 0.005, 0.012]} p={[0, 0.052, z]}><Std c="#8fb3ff" /></Box>)}
      </group>
    </group>
  ),
  atom: ({c, frame}) => (
    <group>
      <Ico rad={0.3} d={1}><Std c={c ?? '#ff6b4a'} /></Ico>
      {[0, 1, 2].map((i) => {
        const rot: V3 = [PI / 2 + i * 0.9, i * 1.1, 0];
        const t = frame * 0.12 + i * 2;
        return (
          <group key={i} rotation={rot}>
            <mesh><torusGeometry args={[0.9, 0.014, 4, 40]} /><Glow c="#9fd8ff" o={0.55} boost={1.2} /></mesh>
            <mesh position={[Math.cos(t) * 0.9, Math.sin(t) * 0.9, 0]}><icosahedronGeometry args={[0.08, 1]} /><Glow c="#4fd8ff" boost={2.2} /></mesh>
            <Halo color="#4fd8ff" size={0.55} opacity={0.75} position={[Math.cos(t) * 0.9, Math.sin(t) * 0.9, 0]} />
          </group>
        );
      })}
    </group>
  ),
  lens: ({c}) => (
    <group rotation={[0, PI / 2, 0]}>
      <mesh scale={[1, 1, 0.25]}><icosahedronGeometry args={[0.6, 2]} /><Std c={c ?? '#bfe9ff'} r={0.05} o={0.5} /></mesh>
      <mesh><torusGeometry args={[0.58, 0.04, 6, 24]} /><Std c="#2b2f36" /></mesh>
    </group>
  ),
  prism: ({c}) => (
    <Cyl a={[0.55, 0.55, 1, 3]} p={[0, 0.5, 0]}><Std c={c ?? '#e8f6ff'} r={0.05} o={0.6} /></Cyl>
  ),
  table: ({c}) => (
    <group>
      <Box s={[2.2, 0.1, 1.2]} p={[0, 0.8, 0]}><Std c={c ?? '#b9824f'} /></Box>
      <Box s={[2.1, 0.08, 1.1]} p={[0, 0.72, 0]}><Std c="#a06f42" /></Box>
      {[[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]].map(([x, z], i) => (
        <Box key={i} s={[0.09, 0.72, 0.09]} p={[x, 0.36, z]}><Std c="#8a5a3b" /></Box>
      ))}
    </group>
  ),

  /* ---------- díly pro hybridní videa (v3) ---------- */
  banana: ({c, frame}) => {
    const arc = PI * 0.78;
    const r = 0.36;
    return (
      <group position={[0, 0.11, 0]} rotation={[PI / 2, 0, -arc / 2 - PI / 2 + Math.sin(frame * 0.03) * 0.05]}>
        <mesh castShadow><torusGeometry args={[r, 0.1, 7, 16, arc]} /><Std c={c ?? '#ffd23f'} r={0.55} /></mesh>
        <mesh scale={[1, 1, 0.45]} position={[0, 0, 0.06]}><torusGeometry args={[r, 0.06, 5, 16, arc * 0.9]} /><Std c="#ffe37a" r={0.5} /></mesh>
        <Ico rad={0.05} p={[r, 0, 0]}><Std c="#5b3a1e" /></Ico>
        <Cyl a={[0.035, 0.05, 0.12, 6]} p={[Math.cos(arc) * r, Math.sin(arc) * r, 0]} r={[0, 0, arc]}><Std c="#7a5a2a" /></Cyl>
      </group>
    );
  },
  clock: ({c, frame}) => (
    <group position={[0, 0.6, 0]}>
      <Cyl a={[0.45, 0.45, 0.14, 24]} r={[PI / 2, 0, 0]}><Std c={c ?? '#e2483d'} r={0.4} /></Cyl>
      <Cyl a={[0.38, 0.38, 0.02, 24]} p={[0, 0, 0.075]} r={[PI / 2, 0, 0]}><Std c="#fffaf0" r={0.6} /></Cyl>
      {Array.from({length: 12}, (_, i) => (
        <Box key={i} s={[0.035, i % 3 === 0 ? 0.09 : 0.05, 0.01]} p={[Math.sin((i * PI) / 6) * 0.31, Math.cos((i * PI) / 6) * 0.31, 0.09]} r={[0, 0, -(i * PI) / 6]}>
          <Std c="#2b2f36" />
        </Box>
      ))}
      <group position={[0, 0, 0.095]} rotation={[0, 0, -frame * 0.006]}><Box s={[0.05, 0.2, 0.01]} p={[0, 0.09, 0]}><Std c="#2b2f36" /></Box></group>
      <group position={[0, 0, 0.1]} rotation={[0, 0, -frame * 0.07]}><Box s={[0.035, 0.29, 0.01]} p={[0, 0.13, 0]}><Std c="#2b2f36" /></Box></group>
      <group position={[0, 0, 0.105]} rotation={[0, 0, -frame * 0.21]}><Box s={[0.014, 0.32, 0.01]} p={[0, 0.12, 0]}><Std c="#e2483d" /></Box></group>
      <Cyl a={[0.035, 0.035, 0.03, 8]} p={[0, 0, 0.11]} r={[PI / 2, 0, 0]}><Std c="#2b2f36" /></Cyl>
      <Cyl a={[0.03, 0.04, 0.22, 6]} p={[-0.25, -0.5, 0]} r={[0, 0, 0.35]}><Std c="#2b2f36" /></Cyl>
      <Cyl a={[0.03, 0.04, 0.22, 6]} p={[0.25, -0.5, 0]} r={[0, 0, -0.35]}><Std c="#2b2f36" /></Cyl>
      <Ico rad={0.11} p={[-0.3, 0.42, 0]} s={[1, 0.6, 1]}><Std c="#c9ccd2" m={1} /></Ico>
      <Ico rad={0.11} p={[0.3, 0.42, 0]} s={[1, 0.6, 1]}><Std c="#c9ccd2" m={1} /></Ico>
    </group>
  ),
  cat: ({c, frame, anim}) => {
    const fur = c ?? '#f0913a';
    // "slide"/"spin": padá vzhůru nohama a během pádu se přetočí; "bob": visí vzhůru nohama;
    // "shake": vzhůru nohama kroutí přední a zadní polovinou
    const falling = anim === 'spin' || anim === 'slide';
    const t = Math.min(1, frame / 40);
    const roll = falling ? PI * (1 - t * t * (3 - 2 * t)) : anim === 'bob' || anim === 'shake' ? PI : 0;
    const twist = falling ? Math.sin(t * PI) * 0.7 : anim === 'shake' ? Math.sin(frame * 0.16) * 0.8 : 0;
    const tuck = falling ? Math.sin(t * PI) : anim === 'shake' ? 0.5 + Math.sin(frame * 0.16) * 0.5 : 0;
    const leg = (x: number, z: number, front: boolean, i: number) => (
      <Cyl key={i} a={[0.04, 0.035, 0.24, 5]} p={[x, -0.19 + (front ? tuck * 0.07 : 0), z]} r={[0, 0, front ? -tuck * 0.9 : tuck * 0.5]}><Std c={fur} /></Cyl>
    );
    return (
      <group position={[0, 0.34, 0]} rotation={[roll, 0, 0]}>
        {/* zadní polovina */}
        <group rotation={[-twist, 0, 0]}>
          <Ico rad={0.2} d={1} p={[-0.12, 0, 0]} s={[1.25, 0.85, 0.85]}><Std c={fur} /></Ico>
          {leg(-0.22, 0.09, false, 0)}
          {leg(-0.22, -0.09, false, 1)}
          <Cyl a={[0.035, 0.025, 0.42, 5]} p={[-0.42, 0.14, 0]} r={[0, 0, 0.75 + Math.sin(frame * 0.12) * 0.25]}><Std c={fur} /></Cyl>
          <Box s={[0.05, 0.02, 0.24]} p={[-0.18, 0.165, 0]}><Std c="#c8682a" /></Box>
        </group>
        {/* přední polovina */}
        <group rotation={[twist, 0, 0]}>
          <Ico rad={0.19} d={1} p={[0.1, 0.01, 0]} s={[1.15, 0.85, 0.85]}><Std c={fur} /></Ico>
          {leg(0.18, 0.09, true, 2)}
          {leg(0.18, -0.09, true, 3)}
          <Box s={[0.05, 0.02, 0.22]} p={[0.02, 0.165, 0]}><Std c="#c8682a" /></Box>
          <group position={[0.34, 0.12, 0]}>
            <Ico rad={0.15} d={1} s={[1, 0.92, 1]}><Std c={fur} /></Ico>
            <mesh position={[0.02, 0.15, 0.08]} rotation={[0.25, 0, -0.1]} castShadow><coneGeometry args={[0.05, 0.1, 4]} /><Std c={fur} /></mesh>
            <mesh position={[0.02, 0.15, -0.08]} rotation={[-0.25, 0, -0.1]} castShadow><coneGeometry args={[0.05, 0.1, 4]} /><Std c={fur} /></mesh>
            <Ico rad={0.028} p={[0.12, 0.04, 0.055]}><Std c="#1d2a1a" r={0.2} /></Ico>
            <Ico rad={0.028} p={[0.12, 0.04, -0.055]}><Std c="#1d2a1a" r={0.2} /></Ico>
            <Ico rad={0.01} p={[0.145, 0.05, 0.06]}><Glow c="#ffffff" /></Ico>
            <Ico rad={0.01} p={[0.145, 0.05, -0.05]}><Glow c="#ffffff" /></Ico>
            <Ico rad={0.02} p={[0.15, -0.01, 0]}><Std c="#ff8fa3" /></Ico>
            <Ico rad={0.06} p={[0.1, -0.05, 0]} s={[1, 0.6, 1.2]}><Std c="#fff1e0" /></Ico>
          </group>
        </group>
      </group>
    );
  },
  candle: ({c, frame}) => {
    const fl = 1 + Math.sin(frame * 0.9) * 0.06 + Math.sin(frame * 2.3) * 0.04;
    return (
      <group>
        <Cyl a={[0.14, 0.15, 0.7, 14]} p={[0, 0.35, 0]}><Std c={c ?? '#f6efe2'} r={0.7} /></Cyl>
        <Ico rad={0.05} p={[0.12, 0.66, 0.04]} s={[0.6, 1.4, 0.6]}><Std c={c ?? '#f6efe2'} r={0.7} /></Ico>
        <Cyl a={[0.16, 0.18, 0.04, 14]} p={[0, 0.02, 0]}><Std c="#c9ccd2" m={1} /></Cyl>
        <Cyl a={[0.008, 0.008, 0.08, 4]} p={[0, 0.74, 0]}><Std c="#222222" /></Cyl>
        <group position={[0, 0.86, 0]} scale={[1, fl, 1]} rotation={[0, 0, Math.sin(frame * 0.5) * 0.06]}>
          <Ico rad={0.075} d={1} s={[1, 2.1, 1]}><Glow c="#ff8a1e" boost={2.4} /></Ico>
          <Ico rad={0.045} d={1} p={[0, -0.03, 0]} s={[1, 1.8, 1]}><Glow c="#fff3b0" boost={3} /></Ico>
        </group>
        <Halo color="#ffb347" size={1.4 * fl} opacity={0.7} position={[0, 0.88, 0]} />
        <pointLight position={[0, 0.9, 0.2]} color="#ffb347" intensity={2.2} distance={4} />
      </group>
    );
  },
  candleSpace: ({c, frame}) => {
    const pulse = 1 + Math.sin(frame * 0.15) * 0.05;
    return (
      <group>
        <Cyl a={[0.14, 0.15, 0.7, 14]} p={[0, 0.35, 0]}><Std c={c ?? '#f6efe2'} r={0.7} /></Cyl>
        <Cyl a={[0.008, 0.008, 0.08, 4]} p={[0, 0.74, 0]}><Std c="#222222" /></Cyl>
        <mesh position={[0, 0.8, 0]} scale={pulse}><icosahedronGeometry args={[0.14, 2]} /><Glow c="#4f8dff" o={0.55} boost={1.6} /></mesh>
        <mesh position={[0, 0.8, 0]} scale={pulse}><icosahedronGeometry args={[0.09, 2]} /><Glow c="#a9d4ff" o={0.75} boost={2} /></mesh>
        <Halo color="#5aa9ff" size={1.2 * pulse} opacity={0.6} position={[0, 0.8, 0]} />
      </group>
    );
  },
  elevator: ({c, glow}) => (
    <group>
      {/* vodicí kolejnice a lano jsou dlouhé, takže při pohybu kabiny vypadají, že stojí */}
      <Box s={[0.08, 30, 0.08]} p={[-0.78, 3, -0.3]}><Std c="#5b616b" m={1} /></Box>
      <Box s={[0.08, 30, 0.08]} p={[0.78, 3, -0.3]}><Std c="#5b616b" m={1} /></Box>
      <Cyl a={[0.025, 0.025, 16, 5]} p={[0, 9.8, 0]}><Std c="#2b2f36" /></Cyl>
      <Box s={[1.3, 0.08, 1.2]} p={[0, 0.04, 0]}><Std c="#8f959e" m={1} /></Box>
      <Box s={[1.3, 0.08, 1.2]} p={[0, 1.76, 0]}><Std c={c ?? '#c9ccd2'} m={1} /></Box>
      <Box s={[1.3, 1.7, 0.06]} p={[0, 0.9, -0.57]}><Std c={c ?? '#c9ccd2'} m={0.6} /></Box>
      <Box s={[0.06, 1.7, 1.2]} p={[-0.62, 0.9, 0]}><Std c={c ?? '#b8bdc4'} m={0.6} /></Box>
      <Box s={[0.06, 1.7, 1.2]} p={[0.62, 0.9, 0]}><Std c={c ?? '#b8bdc4'} m={0.6} /></Box>
      <Box s={[1.24, 1.66, 0.02]} p={[0, 0.9, 0.6]}><Std c="#cfeaff" r={0.05} o={0.18} /></Box>
      <Box s={[0.5, 0.03, 0.3]} p={[0, 1.71, 0]}><Glow c={glow ? '#ff4a3a' : '#fff6d8'} boost={1.6} /></Box>
      <Box s={[0.12, 0.3, 0.03]} p={[0.5, 1.1, -0.53]}><Std c="#2b2f36" /></Box>
      {[1.18, 1.1, 1.02].map((y) => <Ico key={y} rad={0.018} p={[0.5, y, -0.51]}><Glow c="#ffd54a" /></Ico>)}
    </group>
  ),
  ant: ({c, frame}) => {
    const k = c ?? '#3a2418';
    const st = Math.sin(frame * 0.7) * 0.3;
    return (
      <group position={[0, 0.13, 0]}>
        <Ico rad={0.11} d={1} p={[-0.2, 0.03, 0]} s={[1.35, 1, 1]}><Std c={k} r={0.3} /></Ico>
        <Ico rad={0.06} d={1} p={[-0.02, 0.02, 0]} s={[1.5, 0.9, 0.9]}><Std c={k} r={0.3} /></Ico>
        <Ico rad={0.075} d={1} p={[0.13, 0.05, 0]}><Std c={k} r={0.3} /></Ico>
        <Ico rad={0.02} p={[0.18, 0.08, 0.05]}><Glow c="#ffffff" boost={0.9} /></Ico>
        <Ico rad={0.02} p={[0.18, 0.08, -0.05]}><Glow c="#ffffff" boost={0.9} /></Ico>
        {[-0.07, 0, 0.06].flatMap((x, i) =>
          [1, -1].map((side) => (
            <Cyl key={`${i}${side}`} a={[0.012, 0.01, 0.24, 4]} p={[x, -0.05, side * 0.09]} r={[side * (1.1 + (i % 2 ? st : -st) * 0.3), 0, (i - 1) * 0.35]}><Std c={k} /></Cyl>
          )),
        )}
        <Cyl a={[0.008, 0.008, 0.18, 4]} p={[0.2, 0.15, 0.04]} r={[0.4, 0, -0.6]}><Std c={k} /></Cyl>
        <Cyl a={[0.008, 0.008, 0.18, 4]} p={[0.2, 0.15, -0.04]} r={[-0.4, 0, -0.6]}><Std c={k} /></Cyl>
      </group>
    );
  },
  mirror: ({c}) => (
    <group>
      <Box s={[0.7, 0.06, 0.45]} p={[0, 0.03, 0]}><Std c="#6b4a2f" /></Box>
      <Cyl a={[0.035, 0.035, 0.32, 6]} p={[0, 0.2, 0]}><Std c="#6b4a2f" /></Cyl>
      <group position={[0, 1.07, 0]} scale={[0.62, 1, 1]}>
        <mesh castShadow><torusGeometry args={[0.76, 0.06, 6, 28]} /><Std c={c ?? '#c89a4a'} m={1} r={0.4} /></mesh>
        <mesh rotation={[PI / 2, 0, 0]}><cylinderGeometry args={[0.74, 0.74, 0.02, 28]} /><meshStandardMaterial color="#d9ecff" emissive="#9fc8ff" emissiveIntensity={0.35} roughness={0.05} metalness={0.4} flatShading /></mesh>
        <Box s={[0.08, 0.9, 0.01]} p={[-0.3, 0.1, 0.02]} r={[0, 0, 0.5]}><Glow c="#ffffff" o={0.45} /></Box>
        <Box s={[0.04, 0.6, 0.01]} p={[-0.12, 0.15, 0.02]} r={[0, 0, 0.5]}><Glow c="#ffffff" o={0.35} /></Box>
      </group>
    </group>
  ),
  router: ({c, frame}) => (
    <group>
      <Box s={[0.56, 0.12, 0.38]} p={[0, 0.06, 0]}><Std c={c ?? '#f4f6f8'} r={0.4} /></Box>
      <Box s={[0.5, 0.02, 0.3]} p={[0, 0.125, 0]}><Std c="#dfe3e8" /></Box>
      {[-0.2, 0, 0.2].map((x, i) => (
        <Box key={x} s={[0.035, 0.36, 0.035]} p={[x, 0.3, -0.16]} r={[0, 0, (i - 1) * -0.25]}><Std c="#2b2f36" /></Box>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} s={[0.035, 0.02, 0.01]} p={[-0.15 + i * 0.1, 0.07, 0.195]}>
          <Glow c={(Math.floor(frame / (4 + i)) + i) % 3 ? '#3dff8a' : '#0d3a1f'} boost={1.6} />
        </Box>
      ))}
    </group>
  ),
  bird: ({c, frame}) => (
    <group rotation={[0, 0, Math.sin(frame * 0.09) * 0.05]}>
      <Ico rad={0.11} d={1} p={[0, 0.14, 0]} s={[1.4, 1, 1]}><Std c={c ?? '#8a5a3b'} /></Ico>
      <Ico rad={0.08} d={1} p={[0.03, 0.11, 0]} s={[1.3, 0.85, 0.95]}><Std c="#f1dcc0" /></Ico>
      <Ico rad={0.075} d={1} p={[0.14, 0.23, 0]}><Std c={c ?? '#8a5a3b'} /></Ico>
      <mesh position={[0.225, 0.22, 0]} rotation={[0, 0, -PI / 2]}><coneGeometry args={[0.025, 0.07, 4]} /><Std c="#ffb020" /></mesh>
      <Ico rad={0.016} p={[0.19, 0.25, 0.045]}><Std c="#111111" r={0.2} /></Ico>
      <Ico rad={0.016} p={[0.19, 0.25, -0.045]}><Std c="#111111" r={0.2} /></Ico>
      <Box s={[0.16, 0.03, 0.1]} p={[-0.18, 0.17, 0]} r={[0, 0, 0.45]}><Std c="#6b4a2f" /></Box>
      <Ico rad={0.07} p={[-0.03, 0.16, 0.08]} s={[1.5, 0.6, 0.4]}><Std c="#6b4a2f" /></Ico>
      <Ico rad={0.07} p={[-0.03, 0.16, -0.08]} s={[1.5, 0.6, 0.4]}><Std c="#6b4a2f" /></Ico>
      <Cyl a={[0.008, 0.008, 0.07, 4]} p={[0.01, 0.035, 0.03]}><Std c="#ffb020" /></Cyl>
      <Cyl a={[0.008, 0.008, 0.07, 4]} p={[0.01, 0.035, -0.03]}><Std c="#ffb020" /></Cyl>
    </group>
  ),
  powerLine: ({c}) => (
    <group>
      {[-3, 3].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Cyl a={[0.09, 0.13, 4, 7]} p={[0, 2, 0]}><Std c={c ?? '#8a5a3b'} /></Cyl>
          <Box s={[0.1, 0.1, 1.5]} p={[0, 3.75, 0]}><Std c="#7a4e33" /></Box>
          {[-0.6, 0, 0.6].map((z) => <Cyl key={z} a={[0.04, 0.05, 0.12, 6]} p={[0, 3.86, z]}><Std c="#7fd1b0" r={0.2} /></Cyl>)}
        </group>
      ))}
      {[-0.6, 0, 0.6].map((z) => (
        <Cyl key={z} a={[0.018, 0.018, 6.2, 5]} p={[0, 3.92, z]} r={[0, 0, PI / 2]}><Std c="#2b2f36" /></Cyl>
      ))}
    </group>
  ),
  balloon: ({c, frame}) => (
    <group position={[0, Math.sin(frame * 0.05) * 0.03, 0]} rotation={[0, 0, Math.sin(frame * 0.04) * 0.06]}>
      <Ico rad={0.32} d={2} p={[0, 1.15, 0]} s={[1, 1.15, 1]}><Std c={c ?? '#ff4d6d'} r={0.3} /></Ico>
      <Ico rad={0.06} p={[-0.11, 1.3, 0.25]}><Glow c="#ffffff" o={0.6} /></Ico>
      <mesh position={[0, 0.77, 0]} rotation={[PI, 0, 0]}><coneGeometry args={[0.05, 0.07, 6]} /><Std c={c ?? '#ff4d6d'} /></mesh>
      <Cyl a={[0.006, 0.006, 0.75, 4]} p={[0, 0.38, 0]}><Std c="#f4f6f8" /></Cyl>
    </group>
  ),
  paper: ({c}) => (
    <group>
      <Box s={[0.6, 0.02, 0.85]} p={[0, 0.01, 0]}><Std c={c ?? '#fbfbf6'} r={0.9} /></Box>
      <Box s={[0.6, 0.02, 0.43]} p={[0, 0.05, 0.18]} r={[0.12, 0, 0]}><Std c={c ?? '#ffffff'} r={0.9} /></Box>
      {[0.05, 0.15, 0.25].map((z) => <Box key={z} s={[0.48, 0.003, 0.012]} p={[0, 0.072, z]} r={[0.12, 0, 0]}><Std c="#8fb3ff" /></Box>)}
    </group>
  ),
  aquarium: ({c, frame}) => (
    <group>
      <Box s={[1.2, 0.06, 0.6]} p={[0, 0.03, 0]}><Std c="#2b2f36" /></Box>
      <Box s={[1.14, 0.06, 0.54]} p={[0, 0.09, 0]}><Std c="#e8d29a" /></Box>
      <Box s={[1.14, 0.66, 0.54]} p={[0, 0.42, 0]}><Std c={c ?? '#3f9be0'} r={0.1} o={0.5} /></Box>
      <Box s={[1.2, 0.82, 0.6]} p={[0, 0.43, 0]}><Std c="#dff4ff" r={0.05} o={0.18} /></Box>
      <Box s={[1.22, 0.04, 0.62]} p={[0, 0.85, 0]}><Std c="#2b2f36" /></Box>
      {[0, 1].map((i) => {
        const x = Math.sin(frame * 0.03 + i * 2.5) * 0.35;
        const dir = Math.cos(frame * 0.03 + i * 2.5) > 0 ? 1 : -1;
        return (
          <group key={i} position={[x, 0.35 + i * 0.18, -0.05 + i * 0.12]} scale={[dir, 1, 1]}>
            <Ico rad={0.06} s={[1.6, 1, 0.6]}><Std c={i ? '#ffd23f' : '#ff7a35'} /></Ico>
            <mesh position={[-0.11, 0, 0]} rotation={[0, 0, PI / 2]}><coneGeometry args={[0.05, 0.07, 4]} /><Std c={i ? '#ffd23f' : '#ff7a35'} /></mesh>
          </group>
        );
      })}
      {[-0.38, -0.28, 0.4].map((x, i) => (
        <mesh key={x} position={[x, 0.25 + i * 0.03, -0.15]} rotation={[0, 0, Math.sin(frame * 0.05 + i) * 0.1]}><coneGeometry args={[0.05, 0.3 + i * 0.05, 4]} /><Std c="#4fbf6a" /></mesh>
      ))}
    </group>
  ),
  headphones: ({c}) => (
    <group position={[0, 0.2, 0]}>
      <mesh castShadow><torusGeometry args={[0.22, 0.03, 6, 18, PI]} /><Std c="#2b2f36" /></mesh>
      {[-0.22, 0.22].map((x) => (
        <group key={x} position={[x, -0.02, 0]}>
          <Cyl a={[0.1, 0.1, 0.09, 14]} r={[0, 0, PI / 2]}><Std c={c ?? '#ff4d6d'} r={0.35} /></Cyl>
          <Cyl a={[0.08, 0.08, 0.1, 14]} p={[-Math.sign(x) * 0.02, 0, 0]} r={[0, 0, PI / 2]}><Std c="#2b2f36" /></Cyl>
        </group>
      ))}
    </group>
  ),
  weighScale: ({c, frame}) => (
    <group>
      <Box s={[0.64, 0.07, 0.64]} p={[0, 0.035, 0]}><Std c={c ?? '#f4f6f8'} r={0.35} /></Box>
      <Box s={[0.56, 0.01, 0.4]} p={[0, 0.075, -0.06]}><Std c="#dfe3e8" /></Box>
      <Box s={[0.22, 0.012, 0.1]} p={[0, 0.076, 0.22]}><Std c="#10241a" e="#3dff8a" ei={0.9 + Math.sin(frame * 0.3) * 0.2} /></Box>
    </group>
  ),
  earthCut: ({frame}) => (
    <group rotation={[0.15, frame * 0.004, 0]}>
      <mesh><icosahedronGeometry args={[2, 2]} /><Std c="#3f8ee0" r={0.6} o={0.32} /></mesh>
      {[[1.2, 0.9, 1.1], [-1.4, 0.3, 1.3], [0.3, -1.3, 1.5], [0.4, 1.5, -1.2]].map((p, i) => (
        <Ico key={i} rad={0.55} p={p as V3} s={[1, 0.45, 1]}><Std c="#5fbf5a" o={0.45} /></Ico>
      ))}
      <mesh><icosahedronGeometry args={[1.55, 2]} /><Std c="#ff7a35" e="#ff5a1c" ei={0.3} o={0.5} /></mesh>
      <mesh><icosahedronGeometry args={[1.0, 1]} /><Glow c="#ffb020" o={0.8} boost={1.4} /></mesh>
      <mesh><icosahedronGeometry args={[0.55, 1]} /><Glow c="#fff1a0" boost={2} /></mesh>
      <Halo color="#ffcc55" size={3.4} opacity={0.5} />
      <Cyl a={[0.1, 0.1, 4.3, 10]}><Std c="#1b1d22" o={0.75} /></Cyl>
    </group>
  ),
  planet: ({c, frame}) => (
    <group rotation={[0.35, frame * 0.01, 0.1]}>
      <Ico rad={1} d={2}><Std c={c ?? '#e8c07a'} r={0.75} /></Ico>
      {[-0.55, -0.2, 0.15, 0.5].map((y, i) => (
        <Ring key={y} r={Math.sqrt(1 - y * y) * 1.005} t={0.05 + (i % 2) * 0.03} p={[0, y, 0]} rot={[PI / 2, 0, 0]}><Std c="#000000" o={0.16} /></Ring>
      ))}
      <mesh scale={1.07}><icosahedronGeometry args={[1, 2]} /><meshBasicMaterial color={c ?? '#ffe2a8'} transparent opacity={0.14} depthWrite={false} /></mesh>
    </group>
  ),
  carGlass: ({c, frame}) => (
    <group>
      <Box s={[1.9, 0.5, 0.95]} p={[0, 0.45, 0]}><Std c={c ?? '#e2483d'} r={0.45} /></Box>
      <Box s={[1.05, 0.06, 0.86]} p={[-0.1, 1.12, 0]}><Std c={c ?? '#e2483d'} r={0.45} /></Box>
      <Box s={[1.07, 0.42, 0.86]} p={[-0.1, 0.9, 0]}><Std c="#bfe2ff" r={0.05} o={0.2} /></Box>
      {[[-0.6, 0.4], [0.4, 0.4], [-0.6, -0.4], [0.4, -0.4]].map(([x, z], i) => (
        <Box key={i} s={[0.06, 0.42, 0.06]} p={[x, 0.9, z]}><Std c={c ?? '#e2483d'} /></Box>
      ))}
      <Box s={[0.32, 0.3, 0.7]} p={[0.15, 0.8, 0]}><Std c="#3a3d44" /></Box>
      <Box s={[0.08, 0.36, 0.7]} p={[0.0, 0.92, 0]}><Std c="#3a3d44" /></Box>
      <Box s={[0.06, 0.12, 0.22]} p={[0.96, 0.5, 0.3]}><Glow c="#fff2b0" boost={1.6} /></Box>
      <Box s={[0.06, 0.12, 0.22]} p={[0.96, 0.5, -0.3]}><Glow c="#fff2b0" boost={1.6} /></Box>
      {[[-0.6, 0.5], [0.6, 0.5], [-0.6, -0.5], [0.6, -0.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0.22, z]} rotation={[PI / 2, 0, 0]}>
          <group rotation={[0, frame * 0.3, 0]}>
            <Cyl a={[0.22, 0.22, 0.15, 10]}><Std c="#2a2a2a" /></Cyl>
            <Cyl a={[0.11, 0.11, 0.16, 6]}><Std c="#c9ccd2" m={1} /></Cyl>
          </group>
        </group>
      ))}
    </group>
  ),
  astronaut: ({c, frame}) => {
    const suit = c ?? '#f4f6f8';
    return (
      <group>
        <Box s={[0.2, 0.12, 0.3]} p={[-0.13, 0.06, 0.04]}><Std c="#c9ccd2" /></Box>
        <Box s={[0.2, 0.12, 0.3]} p={[0.13, 0.06, 0.04]}><Std c="#c9ccd2" /></Box>
        <Cyl a={[0.11, 0.1, 0.66, 7]} p={[-0.13, 0.43, 0]}><Std c={suit} /></Cyl>
        <Cyl a={[0.11, 0.1, 0.66, 7]} p={[0.13, 0.43, 0]}><Std c={suit} /></Cyl>
        <Cyl a={[0.27, 0.3, 0.75, 10]} p={[0, 1.08, 0]}><Std c={suit} /></Cyl>
        <Box s={[0.5, 0.62, 0.26]} p={[0, 1.12, -0.3]}><Std c="#dfe3e8" /></Box>
        <Box s={[0.22, 0.14, 0.03]} p={[0, 1.18, 0.29]}><Std c="#3a7bff" e="#3a7bff" ei={0.4} /></Box>
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * 0.33, 1.38, 0]} rotation={[0, 0, sd * (0.22 + Math.sin(frame * 0.05) * 0.04)]}>
            <Cyl a={[0.09, 0.08, 0.6, 7]} p={[0, -0.3, 0]}><Std c={suit} /></Cyl>
            <Ico rad={0.1} d={1} p={[0, -0.64, 0]}><Std c="#c9ccd2" /></Ico>
          </group>
        ))}
        <Ico rad={0.3} d={2} p={[0, 1.74, 0]}><Std c={suit} r={0.4} /></Ico>
        <Ico rad={0.24} d={2} p={[0, 1.74, 0.1]} s={[1, 0.8, 0.8]}><meshStandardMaterial color="#d9a93a" emissive="#8a5a10" emissiveIntensity={0.4} roughness={0.15} metalness={0.5} flatShading /></Ico>
        <Ico rad={0.05} p={[-0.08, 1.82, 0.27]}><Glow c="#ffffff" o={0.7} /></Ico>
      </group>
    );
  },
  goal: ({c}) => (
    <group>
      {[-1.6, 1.6].map((x) => <Cyl key={x} a={[0.06, 0.06, 1.6, 8]} p={[x, 0.8, 0]}><Std c={c ?? '#f4f6f8'} /></Cyl>)}
      <Cyl a={[0.06, 0.06, 3.32, 8]} p={[0, 1.6, 0]} r={[0, 0, PI / 2]}><Std c={c ?? '#f4f6f8'} /></Cyl>
      {[-1.6, 1.6].map((x) => <Cyl key={`b${x}`} a={[0.03, 0.03, 1.9, 6]} p={[x, 0.8, -0.55]} r={[0.6, 0, 0]}><Std c="#dfe3e8" /></Cyl>)}
      {Array.from({length: 9}, (_, i) => (
        <Box key={`v${i}`} s={[0.015, 1.55, 0.015]} p={[-1.6 + i * 0.4, 0.78, -0.95]}><Std c="#ffffff" o={0.6} /></Box>
      ))}
      {Array.from({length: 5}, (_, i) => (
        <Box key={`h${i}`} s={[3.2, 0.015, 0.015]} p={[0, 0.15 + i * 0.35, -0.95]}><Std c="#ffffff" o={0.6} /></Box>
      ))}
    </group>
  ),
};

const Arrow: React.FC<{c: string; frame: number; rot: number}> = ({c, frame, rot}) => (
  <group rotation={[0, 0, rot]} position={[Math.sin(frame * 0.12) * 0.07, 0, 0]}>
    <Cyl a={[0.07, 0.07, 1, 8]} p={[-0.1, 0, 0]} r={[0, 0, PI / 2]}><Glow c={c} boost={1.5} /></Cyl>
    <mesh position={[0.55, 0, 0]} rotation={[0, 0, -PI / 2]}><coneGeometry args={[0.18, 0.35, 8]} /><Glow c={c} boost={1.5} /></mesh>
  </group>
);

/** Poloměr kontaktního stínu (chybí = díl létá a stín nedělá). */
const FOOT: Partial<Record<PropType, number>> = {
  table: 1.45, house: 1.6, car: 1.25, boat: 1.2, mountain: 2.4, tree: 1, person: 0.42, fridge: 0.68, stove: 0.8,
  microwave: 0.66, pot: 0.62, cup: 0.3, iceCube: 0.4, ball: 0.38, magnet: 0.65, battery: 0.36, bulb: 0.26,
  phone: 0.34, rocket: 0.5, hotAirBalloon: 0.42, windTurbine: 0.45, thermometer: 0.22, speaker: 0.5, solarPanel: 0.8, prism: 0.55,
  banana: 0.36, clock: 0.32, cat: 0.38, candle: 0.22, elevator: 0.9, ant: 0.24, mirror: 0.42, router: 0.34, paper: 0.45,
  aquarium: 0.72, weighScale: 0.45, carGlass: 1.25, astronaut: 0.45, balloon: 0.08,
};

let blobTex: CanvasTexture | null = null;
const getBlob = () => {
  if (blobTex) return blobTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.5, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  blobTex = new CanvasTexture(cv);
  return blobTex;
};

export const Prop: React.FC<{spec: PropSpec; frame: number; duration: number; enter?: number; stretch?: number; ground?: boolean}> = ({
  spec,
  frame,
  duration,
  enter = 1,
  stretch = 0,
  ground = true,
}) => {
  const Comp = LIB[spec.type];
  if (!Comp || enter <= 0.001) return null;
  const pos = propPositionAt(spec, frame, duration);
  const spin = spec.anim === 'spin' ? frame * 0.03 : 0;
  const pulse = spec.anim === 'pulse' ? 1 + Math.sin(frame * 0.18) * 0.06 : 1;
  // "vanish": předmět v půlce scény zmizí (smrští se)
  const vanishT = spec.anim === 'vanish' ? Math.min(1, Math.max(0, (frame / Math.max(1, duration) - 0.35) / 0.2)) : 0;
  if (vanishT >= 1) return null;
  const s = spec.scale * pulse * enter * (1 - vanishT * vanishT);
  // squash & stretch při naskočení + lehký dopad shora
  const sx = s * (1 - stretch * 0.5);
  const sy = s * (1 + stretch);
  const drop = (1 - Math.min(1, enter)) * 0.6 * spec.scale;
  const a = ANCHOR_Y[spec.type];
  const foot = FOOT[spec.type] ?? 0;
  return (
    <>
      {ground && foot > 0 ? (
        // kontaktní stín zůstává na zemi, i když díl při naskočení padá shora
        <mesh position={[pos[0], pos[1] + 0.012, pos[2]]} rotation={[-PI / 2, 0, 0]} scale={sx * (1 - Math.min(0.6, drop))}>
          <planeGeometry args={[foot * 2.3, foot * 2.3]} />
          <meshBasicMaterial map={getBlob()} transparent opacity={0.3} depthWrite={false} color="#000000" />
        </mesh>
      ) : null}
      <group position={[pos[0], pos[1] + drop, pos[2]]} rotation={[0, (spec.rotationY * PI) / 180 + spin, 0]} scale={[sx, sy, sx]}>
        <Comp c={spec.color} frame={frame} glow={spec.glow} anim={spec.anim} />
        {spec.glow ? <Halo color="#ffd77a" size={Math.max(1.6, a * 3.2) * (1 + Math.sin(frame * 0.15) * 0.05)} opacity={0.3} position={[0, a, 0]} /> : null}
      </group>
    </>
  );
};
