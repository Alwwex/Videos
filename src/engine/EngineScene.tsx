import React, {useLayoutEffect} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import type {PerspectiveCamera} from 'three';
import {applyCamera, cameraAt, projectToScreen} from '../three/camera';
import {Titulek} from '../components/Titulek';
import {Pocitadlo} from '../components/Pocitadlo';
import {Stitek} from '../components/Stitek';
import {fontFamily} from '../fonts';
import {Prop} from './Props';
import {Flow, Stars, Waves} from './Effects';
import {fitItems, propAnchorAt, shotFromSpec, stableAnchorAt} from './anim';
import {FOLLOW_CTA, type RenderScene} from './localize';
import type {Lang} from './schema';
import type {PropSpec, SceneSpec} from './schema';
import type {HookStyle, Theme} from './themes';

type CamState = ReturnType<typeof cameraAt>;

export const CameraRig: React.FC<{state: CamState}> = ({state}) => {
  const {width, height} = useVideoConfig();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => applyCamera(camera, state, width / height));
  useFrame(() => applyCamera(camera, state, width / height));
  return null;
};

/* Pozadí podle tématu videa; barva se navíc střídá po scénách. */
const SPACE_SKY = 'radial-gradient(ellipse at 50% 40%, #2b2f6b 0%, #0d0f26 60%, #05060f 100%)';
export const skyFor = (env: SceneSpec['environment'], theme: Theme, i: number) =>
  env === 'space'
    ? SPACE_SKY
    : env === 'outdoor'
      ? theme.skies[i % theme.skies.length]
      : theme.walls[i % theme.walls.length];

export const Environment: React.FC<{env: SceneSpec['environment']; variant: number; theme: Theme}> = ({env, variant, theme}) => {
  if (env === 'space') {
    return (
      <>
        <ambientLight intensity={0.35} color="#b8c4ff" />
        <directionalLight position={[-8, 6, 8]} intensity={3.2} color="#fff1d6" castShadow />
        <directionalLight position={[6, 4, -9]} intensity={1.6} color="#8fb8ff" />
        <Stars />
      </>
    );
  }
  const indoor = env === 'indoor';
  return (
    <>
      <hemisphereLight args={[indoor ? '#fff0dc' : '#ffe9c9', indoor ? '#b98a5a' : '#8aa86a', indoor ? 1.5 : 1.7]} />
      <ambientLight intensity={0.25} color="#ffd9b0" />
      <directionalLight
        position={indoor ? [-4, 9, 7] : [-6, 10, 6]}
        color={theme.light}
        intensity={indoor ? 2.6 : 3.4}
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
      {/* protisvětlo – světlý obrys odděluje předměty od pozadí */}
      <directionalLight position={[5, 7, -9]} intensity={indoor ? 1.3 : 1.6} color="#ffffff" />
      <fog attach="fog" args={[indoor ? '#f3e3cc' : '#ffd7a8', 32, 70]} />
      {indoor ? (
        <>
          <mesh position={[0, -0.1, 0]} receiveShadow>
            <boxGeometry args={[30, 0.2, 30]} />
            <meshStandardMaterial color={theme.floor} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 5, -6]} receiveShadow>
            <boxGeometry args={[30, 10.2, 0.2]} />
            <meshStandardMaterial color={theme.walls[variant % theme.walls.length]} roughness={1} flatShading />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, -0.3, 0]} receiveShadow>
            <cylinderGeometry args={[18, 18, 0.6, 12]} />
            <meshStandardMaterial color={theme.grass} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, -1.6, 0]}>
            <cylinderGeometry args={[18, 13, 2, 12]} />
            <meshStandardMaterial color="#b97f52" roughness={0.9} flatShading />
          </mesh>
        </>
      )}
    </>
  );
};

/**
 * Auto-rozmístění štítků (pozice pilulek na obrazovce):
 * pásmo y 600–1110 px = pod počítadlem a NAD titulky; dva štítky se nepřekryjí.
 */
const PILL_MIN_Y = 600;
const PILL_MAX_Y = 1110;
const placeLabels = (anchors: {x: number; y: number}[], width: number): [number, number][] => {
  const placed: [number, number][] = [];
  anchors.forEach((a, i) => {
    const px = a.x < width / 2 ? a.x + 230 : a.x - 230;
    let py = Math.max(PILL_MIN_Y, Math.min(PILL_MAX_Y, a.y + (i === 0 ? -230 : 190)));
    for (const [ox, oy] of placed) {
      // stejná strana obrazu a blízko svisle → odsunout
      if (Math.abs(ox - px) < 420 && Math.abs(oy - py) < 120) py = oy + (oy + 130 <= PILL_MAX_Y ? 130 : -130);
    }
    placed.push([px, Math.max(PILL_MIN_Y, Math.min(PILL_MAX_Y, py))]);
  });
  return placed;
};

const Sfx: React.FC<{at: number; src: string; volume: number}> = ({at, src, volume}) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={45} layout="none">
    <Audio src={staticFile(`sfx/${src}.wav`)} volume={volume} />
  </Sequence>
);

/** Úvodní háček: velký titulek, který "dopadne" do obrazu. */
const Hook: React.FC<{title: string; duration: number; style: HookStyle; font: string; accent: string}> = ({title, duration, style, font, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = title.toUpperCase().split(/\s+/);
  const out = interpolate(frame, [duration - 8, duration], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const shake = frame < 10 ? Math.sin(frame * 3.1) * (10 - frame) * 1.6 : 0;
  if (frame > duration) return null;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: out, transform: `translate(${shake}px, ${shake * 0.6}px)`}}>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 40%, rgba(10,6,2,0.55) 0%, rgba(10,6,2,0.25) 45%, rgba(0,0,0,0) 75%)'}} />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0 24px',
          padding: '0 60px',
          marginTop: -260,
          fontFamily: font,
          fontWeight: 900,
          fontSize: 124,
          lineHeight: 1.02,
          textAlign: 'center',
        }}
      >
        {words.map((w, i) => {
          const s = spring({frame: frame - i * (style === 'type' ? 5 : 3), fps, config: {damping: style === 'drop' ? 8 : 12, stiffness: 260, mass: 0.7}});
          const transform =
            style === 'slam'
              ? `scale(${2.2 - s * 1.2}) rotate(${(1 - s) * (i % 2 ? 8 : -8)}deg)`
              : style === 'drop'
                ? `translateY(${(1 - s) * -700}px) rotate(${(1 - s) * (i % 2 ? 20 : -20)}deg)`
                : style === 'zoom'
                  ? `scale(${0.2 + s * 0.8 + Math.max(0, Math.sin(frame * 0.25)) * 0.03})`
                  : `translateX(${(1 - s) * (i % 2 ? 600 : -600)}px)`;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                color: i === words.length - 1 || i === 0 ? accent : '#FFFFFF',
                transform,
                opacity: Math.min(1, s * 2),
                WebkitTextStroke: '14px rgba(20,12,4,0.92)',
                paintOrder: 'stroke fill',
                textShadow: '0 14px 0 rgba(20,12,4,0.55)',
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Závěrečná výzva "sleduj pro další díl" s pulzujícím tlačítkem. */
const EndCard: React.FC<{text: string; start: number; font: string; accent: string}> = ({text, start, font, accent}) => {
  const frame = useCurrentFrame() - start;
  const {fps} = useVideoConfig();
  if (frame < 0) return null;
  const s = spring({frame, fps, config: {damping: 11, stiffness: 190, mass: 0.7}});
  const pulse = 1 + Math.max(0, Math.sin(frame * 0.22)) * 0.05;
  const hand = spring({frame: frame - 10, fps, config: {damping: 8, stiffness: 160}});
  const tap = Math.max(0, Math.sin(frame * 0.22)) * 14;
  // delší texty (např. rumunština) zmenší písmo, ať se pilulka vejde na šířku
  const fs = Math.min(58, Math.round((58 * 800) / (text.length * 40)));
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      {/* nahoře pod nadpisem série – dole jsou titulky a uprostřed bývá postavička */}
      <div style={{position: 'relative', marginTop: 270, transform: `scale(${s * pulse}) rotate(${(1 - s) * -8}deg)`, opacity: Math.min(1, s * 2)}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '26px 46px',
            borderRadius: 999,
            background: accent,
            color: '#1a1307',
            fontFamily: font,
            fontWeight: 900,
            fontSize: fs,
            letterSpacing: 0.5,
            boxShadow: `0 14px 0 rgba(20,12,4,0.45), 0 0 60px ${accent}aa`,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{fontSize: fs * 1.1}}>➕</span>
          {text}
        </div>
        {/* ruka ťuká do pravého rohu tlačítka – nezakrývá střed obrazu */}
        <div style={{position: 'absolute', right: -18, bottom: -96, fontSize: 92, transform: `translateY(${(1 - hand) * 80 - tap}px) rotate(-18deg)`, opacity: hand}}>👆</div>
      </div>
    </AbsoluteFill>
  );
};

/** Obálka přiblížení: rychlý náběh (6 snímků), pak pomalé doznění. */
const punchEnv = (t: number) => (t < 0 ? 0 : t < 6 ? Easing.out(Easing.cubic)(t / 6) : Math.exp(-(t - 6) / 14));

const NO_POP = new Set(['table', 'waterPool', 'house', 'mountain']);

export const EngineScene: React.FC<{scene: RenderScene; index: number; prevProps: PropSpec[]; title: string; theme: Theme; isLast: boolean; lang: Lang}> = ({
  scene,
  index,
  prevProps,
  title,
  theme,
  isLast,
  lang,
}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const {spec, durationInFrames: dur} = scene;
  const byId = new Map(spec.props.map((p) => [p.id, p]));
  const anchor = (id: string) => {
    const p = byId.get(id);
    return p ? propAnchorAt(p, frame, dur) : ([0, 1, 0] as [number, number, number]);
  };
  const focusProp = byId.get(spec.camera.focus) ?? spec.props[0];
  const focus = focusProp ? propAnchorAt(focusProp, 0, dur) : ([0, 1, 0] as [number, number, number]);
  const shot = shotFromSpec(spec.camera, focus, fitItems(spec.props, dur));

  // přiblížení kamery ve chvíli, kdy zazní klíčové slovo
  const punches = scene.captions.filter((c) => c.text.includes('*')).map((c) => c.start + 2);
  const punch = punches.reduce((m, p) => Math.max(m, punchEnv(frame - p)), 0);
  const base = cameraAt(shot, frame, dur);
  const cam: CamState = {...base, fov: base.fov * (1 - 0.06 * punch)};
  const cam0: CamState = cameraAt(shot, 0, dur);

  // štítky: kotva sleduje předmět, pilulky se rozmístí jednou (z 1. snímku) a pak stojí
  const labelSrc = scene.labels.filter((l) => byId.has(l.prop)).map((l) => ({l, pr: byId.get(l.prop)!}));
  const pills = placeLabels(
    labelSrc.map(({pr}) => projectToScreen(cam0, stableAnchorAt(pr, 0, dur), width, height)),
    width,
  );
  const labels = labelSrc.map(({l, pr}, i) => ({l, p: projectToScreen(cam, stableAnchorAt(pr, frame, dur), width, height), pill: pills[i]}));

  // předměty, které v minulé scéně nebyly, naskočí s odrazem
  const prevKeys = new Set(prevProps.map((p) => `${p.id}:${p.type}`));
  let popIndex = 0;
  const popCfg = {damping: 9, stiffness: 170, mass: 0.6};
  const enter = (p: PropSpec) => {
    if (NO_POP.has(p.type) || prevKeys.has(`${p.id}:${p.type}`)) return {e: 1, st: 0};
    const d = 2 + popIndex++ * 4;
    const e = spring({frame: frame - d, fps, config: popCfg});
    const prev = spring({frame: frame - d - 1, fps, config: popCfg});
    // natažení při růstu, zplacatění při dopadu (squash & stretch)
    return {e, st: Math.max(-0.28, Math.min(0.28, (e - prev) * 3.2))};
  };
  const enters = spec.props.map(enter);

  // střih: krátký zoom + světlý záblesk
  const cut = interpolate(frame, [0, 9], [1, 0], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const countFrames = Math.min(50, Math.round(dur * 0.6));
  const isHook = index === 0;
  const tr = theme.transition;
  const sceneTransform =
    tr === 'zoom'
      ? `scale(${1 + cut * 0.22})`
      : tr === 'tilt'
        ? `scale(${1 + cut * 0.12}) rotate(${cut * (index % 2 ? 4 : -4)}deg)`
        : tr === 'wipe'
          ? `translateX(${cut * (index % 2 ? 120 : -120)}px) scale(${1 + cut * 0.05})`
          : `scale(${1 + cut * 0.1})`;
  const flashOpacity = isHook ? cut * 0.9 : tr === 'flash' ? cut * 0.5 : tr === 'zoom' ? cut * 0.15 : 0;
  const hookDur = Math.min(48, dur - 10);
  // během háčku jen velký titulek – běžné titulky a štítky naběhnou až po něm
  const showOverlay = !isHook || frame >= hookDur;

  return (
    <AbsoluteFill style={{background: skyFor(spec.environment, theme, index)}}>
      {scene.audioSrc ? <Audio src={staticFile(scene.audioSrc)} /> : null}
      {isHook ? <Sfx at={0} src="boom" volume={0.55} /> : null}
      {scene.labels.map((_, i) => (
        <Sfx key={`p${i}`} at={(isHook ? hookDur : 0) + 8 + i * 18 + 12} src="pop" volume={0.45} />
      ))}
      {scene.counter ? (
        <>
          {Array.from({length: Math.floor(countFrames / 4)}).map((_, i) => (
            <Sfx key={`t${i}`} at={4 + i * 4} src="tick" volume={0.12} />
          ))}
          <Sfx at={4 + countFrames} src="ding" volume={0.3} />
        </>
      ) : null}

      <AbsoluteFill style={{transform: sceneTransform, filter: 'saturate(1.3) contrast(1.06)'}}>
        <ThreeCanvas width={width} height={height} shadows gl={{antialias: true}}>
          <CameraRig state={cam} />
          <Environment env={spec.environment} variant={index} theme={theme} />
          {spec.props.map((p, i) => (
            <Prop key={p.id} spec={p} frame={frame} duration={dur} enter={enters[i].e} stretch={enters[i].st} ground={spec.environment !== 'space'} />
          ))}
          {spec.flows.map((f, i) =>
            byId.has(f.from) && byId.has(f.to) ? (
              <Flow key={i} kind={f.kind} a={anchor(f.from)} b={anchor(f.to)} frame={frame} seed={i * 31} />
            ) : null,
          )}
          {spec.waves.map((w, i) => (byId.has(w.from) ? <Waves key={i} kind={w.kind} at={anchor(w.from)} frame={frame} camPos={cam.position} /> : null))}
        </ThreeCanvas>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(40,15,0,0.3) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 62%, rgba(30,10,0,0.5) 100%)',
        }}
      />

      {showOverlay && labels.map(({l, p, pill}, i) => (
        // pilulka stojí na místě (spočítaném z 1. snímku), jen tečka a čára sledují předmět
        <Stitek key={i} emoji={l.emoji} text={l.text} x={p.x} y={p.y} offset={[pill[0] - p.x, pill[1] - p.y]} delay={(isHook ? hookDur : 0) + 8 + i * 18} font={theme.font} />
      ))}

      {scene.counter ? <Pocitadlo {...scene.counter} countFrames={countFrames} color={theme.accent} font={theme.font} /> : null}
      {isHook ? <Hook title={title} duration={hookDur} style={theme.hook} font={theme.font} accent={theme.accent} /> : null}
      {showOverlay ? <Titulek
          captions={scene.captions.map((c) => c.text)}
          starts={scene.captions.map((c) => c.start)}
          wordStarts={scene.captions.map((c) => c.wordStarts)}
          durationInFrames={dur} highlightColor={theme.accent} font={theme.font} bottom={theme.captionBottom} /> : null}
      {isLast ? <EndCard text={FOLLOW_CTA[lang]} start={Math.round(dur * 0.25)} font={theme.font} accent={theme.accent} /> : null}
      {tr === 'wipe' && !isHook ? (
        <AbsoluteFill style={{background: theme.accent, transform: `translateX(${(index % 2 ? 1 : -1) * (1 - cut) * 110}%)`, opacity: cut > 0.02 ? 1 : 0}} />
      ) : null}
      <AbsoluteFill style={{background: theme.flash, opacity: flashOpacity}} />
    </AbsoluteFill>
  );
};
