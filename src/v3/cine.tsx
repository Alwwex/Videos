import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Stars} from '../engine/Effects';
import type {SceneSpec} from '../engine/schema';
import {themeFor, type Theme} from '../engine/themes';

/* Filmový vzhled hybridních videí: sytější tmavší barvy, barevné kontrasvětlo, mlha a prach ve vzduchu. */

export type CineTheme = Theme & {fog: string; hemiSky: string; hemiGround: string; rimA: string; rimB: string};

type Palette = Pick<CineTheme, 'name' | 'accent' | 'bar' | 'walls' | 'skies' | 'floor' | 'light' | 'grass' | 'flash' | 'fog' | 'hemiSky' | 'hemiGround' | 'rimA' | 'rimB'>;

const PALETTES: Palette[] = [
  {
    name: 'noc',
    accent: '#4FD8FF',
    bar: ['#4FD8FF', '#9B7BFF'],
    walls: ['#2c3170', '#352b6f', '#283a70'],
    skies: ['linear-gradient(180deg, #0a0f2e 0%, #1f2163 45%, #4b2a7a 100%)', 'linear-gradient(180deg, #0c1236 0%, #252a78 55%, #6a3a8a 100%)'],
    floor: '#252a5c',
    light: '#ffe3bd',
    grass: '#2f7a62',
    flash: '#e8f6ff',
    fog: '#262361',
    hemiSky: '#9fb4ff',
    hemiGround: '#2a1f4a',
    rimA: '#4fd8ff',
    rimB: '#ff5fb0',
  },
  {
    name: 'západ',
    accent: '#FFC83D',
    bar: ['#FFC83D', '#FF6B8B'],
    walls: ['#5a3262', '#6c3654', '#4d2e66'],
    skies: ['linear-gradient(180deg, #22164a 0%, #7a2f6e 52%, #ff8a4c 100%)', 'linear-gradient(180deg, #2a1650 0%, #8e3468 55%, #ffa35a 100%)'],
    floor: '#40244a',
    light: '#ffd4a6',
    grass: '#558f4c',
    flash: '#fff1e6',
    fog: '#5e2b57',
    hemiSky: '#ffb995',
    hemiGround: '#3a1f3a',
    rimA: '#ffb347',
    rimB: '#7c6bff',
  },
  {
    name: 'laboratoř',
    accent: '#3DFFD0',
    bar: ['#3DFFD0', '#4FA8FF'],
    walls: ['#14434c', '#183c52', '#114c4c'],
    skies: ['linear-gradient(180deg, #041a22 0%, #0b4450 55%, #178a7f 100%)', 'linear-gradient(180deg, #06202c 0%, #0f4f63 55%, #1f9a8a 100%)'],
    floor: '#10343c',
    light: '#eafff7',
    grass: '#33906a',
    flash: '#eafff8',
    fog: '#0e3a42',
    hemiSky: '#cdeee8',
    hemiGround: '#0c2630',
    rimA: '#8ff5dd',
    rimB: '#ff6b8b',
  },
  {
    name: 'žár',
    accent: '#FFD43B',
    bar: ['#FFD43B', '#FF7A35'],
    walls: ['#41271c', '#4d2c1e', '#3a231c'],
    skies: ['linear-gradient(180deg, #140c08 0%, #45241a 55%, #b0522a 100%)', 'linear-gradient(180deg, #1a0f0a 0%, #522a1c 55%, #c2622e 100%)'],
    floor: '#2e1d14',
    light: '#ffdcaa',
    grass: '#6c8c3c',
    flash: '#fff4e0',
    fog: '#3c2016',
    hemiSky: '#ffcc9e',
    hemiGround: '#2a140c',
    rimA: '#ff9a2e',
    rimB: '#4fd8ff',
  },
];

export const cineThemeFor = (id: number): CineTheme => ({...themeFor(id), ...PALETTES[id % PALETTES.length]});

const SPACE_SKY = 'radial-gradient(ellipse at 50% 38%, #2b2f6b 0%, #110f2e 55%, #05060f 100%)';
export const cineSky = (env: SceneSpec['environment'], th: CineTheme, i: number) =>
  env === 'space' ? SPACE_SKY : env === 'outdoor' ? th.skies[i % th.skies.length] : th.walls[i % th.walls.length];

/** Světla, mlha a podlaha/ostrov – jako původní Environment, ale s filmovým nasvícením. */
export const CineEnvironment: React.FC<{env: SceneSpec['environment']; variant: number; th: CineTheme}> = ({env, variant, th}) => {
  if (env === 'space') {
    return (
      <>
        <ambientLight intensity={0.3} color="#b8c4ff" />
        <directionalLight position={[-8, 6, 8]} intensity={3.2} color="#fff1d6" castShadow />
        <directionalLight position={[6, 4, -9]} intensity={2} color={th.rimA} />
        <directionalLight position={[-6, -3, -8]} intensity={1.2} color={th.rimB} />
        <Stars />
      </>
    );
  }
  const indoor = env === 'indoor';
  return (
    <>
      <hemisphereLight args={[th.hemiSky, th.hemiGround, indoor ? 1.0 : 1.15]} />
      <ambientLight intensity={0.16} color="#ffffff" />
      <directionalLight
        position={indoor ? [-4, 9, 7] : [-6, 10, 6]}
        color={th.light}
        intensity={indoor ? 2.9 : 3.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-radius={5}
        shadow-blurSamples={12}
      />
      {/* barevné kontrasvětlo zezadu – předměty dostanou svítící obrys */}
      <directionalLight position={[6, 6, -9]} intensity={2.1} color={th.rimA} />
      <directionalLight position={[-7, 4, -8]} intensity={1.3} color={th.rimB} />
      <fog attach="fog" args={[th.fog, 26, 64]} />
      {indoor ? (
        <>
          <mesh position={[0, -0.1, 0]} receiveShadow>
            <boxGeometry args={[30, 0.2, 30]} />
            <meshStandardMaterial color={th.floor} roughness={0.85} flatShading />
          </mesh>
          <mesh position={[0, 5, -6]} receiveShadow>
            <boxGeometry args={[30, 10.2, 0.2]} />
            <meshStandardMaterial color={th.walls[variant % th.walls.length]} roughness={1} flatShading />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, -0.3, 0]} receiveShadow>
            <cylinderGeometry args={[18, 18, 0.6, 12]} />
            <meshStandardMaterial color={th.grass} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, -1.6, 0]}>
            <cylinderGeometry args={[18, 13, 2, 12]} />
            <meshStandardMaterial color="#6a4632" roughness={0.9} flatShading />
          </mesh>
        </>
      )}
    </>
  );
};

const rnd = (i: number) => {
  const x = Math.sin(i * 91.7 + 13.1) * 43758.5453;
  return x - Math.floor(x);
};

/** Prach a světelné tečky ve vzduchu (2D vrstva) – dodá hloubku a "filmovost". */
export const Dust: React.FC<{color?: string; count?: number}> = ({color = '#fff4dc', count = 34}) => {
  const f = useCurrentFrame();
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none'}}>
      {Array.from({length: count}, (_, i) => {
        const near = rnd(i + 3) > 0.8;
        const size = near ? 10 + rnd(i) * 14 : 3 + rnd(i) * 6;
        const speed = (near ? 1.6 : 0.6) + rnd(i + 7) * 0.8;
        const x = rnd(i + 11) * 1080 + Math.sin(f * 0.02 + i) * 24;
        const y = ((rnd(i + 17) * 2100 - f * speed) % 2100 + 2100) % 2100 - 90;
        const op = (near ? 0.12 : 0.28) + rnd(i + 23) * 0.25;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: color,
              opacity: op * (0.7 + 0.3 * Math.sin(f * 0.07 + i)),
              filter: `blur(${near ? 4 : 1}px)`,
            }}
          />
        );
      })}
    </div>
  );
};
