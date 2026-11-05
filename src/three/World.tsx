import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {ExtrudeGeometry, Shape, TubeGeometry} from 'three';
import type {Effects, Vec3} from '../types';
import {
  AC_CURVE,
  DC_CURVE,
  FRONT_SLOPE_CENTER,
  HOUSE,
  INVERTER_POS,
  ROOF_ANGLE,
  ROOF_RISE,
  ROOF_SLOPE_LEN,
  SUN_POS,
  rand,
} from './layout';
import {Photons, Current} from './Particles';

const Mat: React.FC<{color: string; emissive?: string; emissiveIntensity?: number; roughness?: number; metalness?: number}> = ({
  color,
  emissive = '#000000',
  emissiveIntensity = 0,
  roughness = 0.85,
  metalness = 0,
}) => (
  <meshStandardMaterial
    color={color}
    emissive={emissive}
    emissiveIntensity={emissiveIntensity}
    roughness={roughness}
    metalness={metalness}
    flatShading
  />
);

const Tree: React.FC<{position: Vec3; scale?: number; seed: number}> = ({position, scale = 1, seed}) => (
  <group position={position} scale={scale} rotation={[0, rand(seed) * Math.PI, 0]}>
    <mesh position={[0, 0.5, 0]} castShadow>
      <cylinderGeometry args={[0.12, 0.18, 1, 5]} />
      <Mat color="#8a5a3b" />
    </mesh>
    <mesh position={[0, 1.5, 0]} castShadow>
      <coneGeometry args={[0.95, 1.6, 6]} />
      <Mat color={seed % 2 ? '#4f9a4a' : '#5fae54'} />
    </mesh>
    <mesh position={[0, 2.35, 0]} castShadow>
      <coneGeometry args={[0.7, 1.3, 6]} />
      <Mat color={seed % 2 ? '#5fae54' : '#6fbf5e'} />
    </mesh>
  </group>
);

const Bush: React.FC<{position: Vec3; s?: number}> = ({position, s = 0.5}) => (
  <mesh position={position} scale={[s, s * 0.8, s]} castShadow receiveShadow>
    <icosahedronGeometry args={[1, 0]} />
    <Mat color="#6cb85a" />
  </mesh>
);

const Cloud: React.FC<{position: Vec3; drift: number}> = ({position, drift}) => (
  <group position={[position[0] + drift, position[1], position[2]]}>
    {[
      [0, 0, 0, 1],
      [0.9, -0.15, 0.1, 0.75],
      [-0.9, -0.2, 0, 0.7],
      [0.3, 0.45, -0.1, 0.65],
    ].map(([x, y, z, s], i) => (
      <mesh key={i} position={[x, y, z]} scale={s}>
        <icosahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#fff6ea" emissive="#ffe8cc" emissiveIntensity={0.55} roughness={1} flatShading />
      </mesh>
    ))}
  </group>
);

const Sun: React.FC<{frame: number}> = ({frame}) => {
  const pulse = 1 + Math.sin(frame * 0.12) * 0.04;
  return (
    <group position={SUN_POS}>
      <mesh rotation={[frame * 0.004, frame * 0.01, 0]}>
        <icosahedronGeometry args={[1.25, 1]} />
        <meshBasicMaterial color="#ffd54a" toneMapped={false} />
      </mesh>
      <mesh scale={1.55 * pulse} rotation={[0, -frame * 0.006, frame * 0.004]}>
        <icosahedronGeometry args={[1.25, 0]} />
        <meshBasicMaterial color="#ffb347" toneMapped={false} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh scale={2.1 * pulse}>
        <icosahedronGeometry args={[1.25, 1]} />
        <meshBasicMaterial color="#ffcf7a" toneMapped={false} transparent opacity={0.15} depthWrite={false} />
      </mesh>
    </group>
  );
};

/** Jeden solární panel (v lokálních souřadnicích střešní plochy) */
const Panel: React.FC<{position: Vec3; glow: number}> = ({position, glow}) => (
  <group position={position}>
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1.16, 0.05, 0.78]} />
      <Mat color="#d9dde3" roughness={0.4} metalness={0.5} />
    </mesh>
    <mesh position={[0, 0.03, 0]} receiveShadow>
      <boxGeometry args={[1.08, 0.02, 0.7]} />
      <Mat color="#1d3f94" emissive="#3a7bff" emissiveIntensity={glow} roughness={0.3} metalness={0.35} />
    </mesh>
    {/* mřížka článků */}
    {[-0.36, -0.18, 0, 0.18, 0.36].map((x) => (
      <mesh key={`x${x}`} position={[x, 0.045, 0]}>
        <boxGeometry args={[0.012, 0.005, 0.7]} />
        <meshStandardMaterial color="#8fb3ff" />
      </mesh>
    ))}
    {[-0.12, 0.12].map((z) => (
      <mesh key={`z${z}`} position={[0, 0.045, z]}>
        <boxGeometry args={[1.08, 0.005, 0.012]} />
        <meshStandardMaterial color="#8fb3ff" />
      </mesh>
    ))}
  </group>
);

const House: React.FC<{lights: number; panelGlow: number}> = ({lights, panelGlow}) => {
  const gable = useMemo(() => {
    const s = new Shape();
    s.moveTo(-HOUSE.depth / 2, 0);
    s.lineTo(HOUSE.depth / 2, 0);
    s.lineTo(0, ROOF_RISE);
    s.closePath();
    return new ExtrudeGeometry(s, {depth: HOUSE.width, bevelEnabled: false});
  }, []);

  const windowMat = (
    <Mat color={lights > 0.05 ? '#ffe9a8' : '#7fb6d9'} emissive="#ffcc55" emissiveIntensity={lights * 1.6} roughness={0.3} />
  );

  return (
    <group>
      {/* zdi */}
      <mesh position={[0, HOUSE.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[HOUSE.width, HOUSE.height, HOUSE.depth]} />
        <Mat color="#f3e1c4" />
      </mesh>
      {/* štíty */}
      <mesh geometry={gable} position={[-HOUSE.width / 2, HOUSE.height, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <Mat color="#ecd6b4" />
      </mesh>
      {/* střecha */}
      <mesh position={FRONT_SLOPE_CENTER} rotation={[ROOF_ANGLE, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[HOUSE.width + 0.4, 0.12, ROOF_SLOPE_LEN]} />
        <Mat color="#c8553d" />
      </mesh>
      <mesh
        position={[FRONT_SLOPE_CENTER[0], FRONT_SLOPE_CENTER[1], -FRONT_SLOPE_CENTER[2]]}
        rotation={[-ROOF_ANGLE, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[HOUSE.width + 0.4, 0.12, ROOF_SLOPE_LEN]} />
        <Mat color="#b8492f" />
      </mesh>
      {/* komín */}
      <mesh position={[-1.2, 3.4, -0.6]} castShadow>
        <boxGeometry args={[0.4, 1, 0.4]} />
        <Mat color="#a8513a" />
      </mesh>
      {/* panely na přední střeše */}
      <group position={FRONT_SLOPE_CENTER} rotation={[ROOF_ANGLE, 0, 0]}>
        {[-1.25, 0, 1.25].flatMap((x) =>
          [-0.42, 0.42].map((z) => <Panel key={`${x}${z}`} position={[x, 0.1, z]} glow={panelGlow} />),
        )}
      </group>
      {/* dveře */}
      <mesh position={[-0.8, 0.65, HOUSE.depth / 2 + 0.02]} castShadow>
        <boxGeometry args={[0.7, 1.3, 0.06]} />
        <Mat color="#9c5634" />
      </mesh>
      {/* okna */}
      <mesh position={[0.8, 1.5, HOUSE.depth / 2 + 0.02]}>
        <boxGeometry args={[0.9, 0.75, 0.06]} />
        {windowMat}
      </mesh>
      <mesh position={[HOUSE.width / 2 + 0.02, 1.5, -0.6]}>
        <boxGeometry args={[0.06, 0.75, 0.8]} />
        {windowMat}
      </mesh>
      <mesh position={[-HOUSE.width / 2 - 0.02, 1.5, 0.3]}>
        <boxGeometry args={[0.06, 0.75, 0.8]} />
        {windowMat}
      </mesh>
      {lights > 0.05 ? <pointLight position={[0.8, 1.5, 2.1]} color="#ffbb55" intensity={lights * 4} distance={4} /> : null}
    </group>
  );
};

const Inverter: React.FC<{active: boolean; frame: number}> = ({active, frame}) => (
  <group position={INVERTER_POS}>
    <mesh castShadow>
      <boxGeometry args={[0.16, 0.7, 0.5]} />
      <Mat color="#eef0f2" roughness={0.5} />
    </mesh>
    <mesh position={[0.085, 0.18, 0]}>
      <boxGeometry args={[0.02, 0.12, 0.3]} />
      <Mat color="#2b3440" emissive="#4fd8ff" emissiveIntensity={active ? 0.8 : 0.1} />
    </mesh>
    <mesh position={[0.085, -0.15, 0.14]}>
      <boxGeometry args={[0.02, 0.06, 0.06]} />
      <meshBasicMaterial color={active && Math.floor(frame / 8) % 2 ? '#5dff7a' : '#2c7a3a'} />
    </mesh>
  </group>
);

const Wire: React.FC<{curve: typeof DC_CURVE}> = ({curve}) => {
  const geo = useMemo(() => new TubeGeometry(curve, 48, 0.035, 6, false), [curve]);
  return (
    <mesh geometry={geo} castShadow>
      <Mat color="#2a2a2a" roughness={0.6} />
    </mesh>
  );
};

export const World: React.FC<{effects: Effects; sceneFrame: number}> = ({effects, sceneFrame}) => {
  const frame = useCurrentFrame();
  const lights = effects.lights ? Math.min(1, Math.max(0, (sceneFrame - 10) / 20)) : 0;
  const panelGlow = effects.panelGlow ? 0.25 + Math.sin(frame * 0.2) * 0.12 : 0.05;

  return (
    <>
      {/* teplé světlo + měkké stíny */}
      <hemisphereLight args={['#ffe9c9', '#8aa86a', 1.7]} />
      <ambientLight intensity={0.25} color="#ffd9b0" />
      <directionalLight
        position={SUN_POS}
        color="#ffd29a"
        intensity={3.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-radius={6}
      />
      <fog attach="fog" args={['#ffd7a8', 32, 70]} />

      <Sun frame={frame} />
      <Cloud position={[-6, 10.5, -6]} drift={frame * 0.008} />
      <Cloud position={[4.5, 12, -9]} drift={-frame * 0.006} />
      <Cloud position={[3, 8.5, -4]} drift={frame * 0.005} />

      {/* ostrov */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <cylinderGeometry args={[16, 16, 0.6, 12]} />
        <Mat color="#8fc76a" />
      </mesh>
      <mesh position={[0, -1.6, 0]}>
        <cylinderGeometry args={[16, 12, 2, 12]} />
        <Mat color="#b97f52" />
      </mesh>
      {/* cestička */}
      <mesh position={[-0.8, 0.01, 4.5]} receiveShadow>
        <boxGeometry args={[0.9, 0.02, 6]} />
        <Mat color="#e8cf9e" />
      </mesh>

      <House lights={lights} panelGlow={panelGlow} />
      <Wire curve={DC_CURVE} />
      <Wire curve={AC_CURVE} />
      <Inverter active={Boolean(effects.dcCurrent)} frame={frame} />

      <Tree position={[-5, 0, 1.5]} seed={1} />
      <Tree position={[-6.5, 0, -2.5]} scale={1.3} seed={2} />
      <Tree position={[5.8, 0, -3]} scale={1.2} seed={3} />
      <Tree position={[-3.5, 0, -5]} seed={4} />
      <Tree position={[7.5, 0, 1]} scale={0.9} seed={5} />
      <Tree position={[-8, 0, 4]} scale={1.1} seed={6} />
      <Bush position={[-2.6, 0.25, 1.9]} />
      <Bush position={[3, 0.2, 2.4]} s={0.4} />
      <Bush position={[-2.9, 0.2, -1.2]} s={0.45} />
      <Bush position={[1.2, 0.2, 3.6]} s={0.35} />

      {effects.photons ? <Photons frame={frame} /> : null}
      {effects.dcCurrent ? <Current curve={DC_CURVE} frame={frame} color="#4fd8ff" count={10} speed={0.012} /> : null}
      {effects.acCurrent ? <Current curve={AC_CURVE} frame={frame} color="#ffb020" count={8} speed={0.01} wobble /> : null}
    </>
  );
};
