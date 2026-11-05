import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {CameraRig, Environment, skyFor} from '../engine/EngineScene';
import {Prop} from '../engine/Props';
import {Flow, Waves} from '../engine/Effects';
import {fitItems, propAnchorAt, shotFromSpec, stableAnchorAt} from '../engine/anim';
import {estimateTimeline, tokenize} from '../engine/localize';
import type {Lang, PropSpec, SceneSpec as V1Scene, SceneTimeline, Timeline} from '../engine/schema';
import {themeFor, type Theme} from '../engine/themes';
import {cameraAt, projectToScreen} from '../three/camera';
import {Captions, Hook, InfoCard, Note, groupWords, placeNotes, type CapGroup, type NotePos} from './overlays';
import type {HybridSceneSpec, HybridScript} from './schema';

export const FPS = 30;

/** Časová osa: buď jeden souvislý hlas (continuous), nebo MP3 pro každou scénu. */
export type HybridTimeline = Timeline & {continuous?: boolean; audioSrc?: string | null; scenes: (SceneTimeline & {startSec?: number})[]};

export type HybridProps = {
  script: HybridScript;
  lang: Lang;
  timeline: HybridTimeline | null;
  /** cesta k hudbě v public/; undefined = smyčka podle tématu, null = bez hudby */
  music?: string | null;
  musicVolume?: number;
};

type HScene = {spec: HybridSceneSpec; from: number; dur: number; groups: CapGroup[]; audioSrc: string | null};

const localize = (script: HybridScript, lang: Lang, tl: HybridTimeline | null): HScene[] => {
  const cont = !!(tl?.continuous && tl.scenes.length === script.scenes.length);
  const tls: (SceneTimeline & {startSec?: number})[] = script.scenes.map((sc, i) => tl?.scenes[i] ?? estimateTimeline(sc as unknown as V1Scene, lang));
  const out: HScene[] = [];
  let cursor = 0;
  script.scenes.forEach((spec, i) => {
    const t = tls[i];
    let from: number;
    let dur: number;
    if (cont) {
      from = Math.round((t.startSec ?? 0) * FPS);
      const next = tls[i + 1] as SceneTimeline & {startSec?: number};
      const end = next ? Math.round((next.startSec ?? 0) * FPS) : Math.round(((t.startSec ?? 0) + t.durationSec) * FPS);
      dur = Math.max(12, end - from);
    } else {
      from = cursor;
      dur = Math.max(Math.round(1.3 * FPS), Math.ceil((t.durationSec + 0.05) * FPS));
    }
    cursor = from + dur;
    const words = tokenize(spec.narration[lang]);
    const groups = groupWords(words.map((w, k) => ({text: w.text, hl: w.highlight, start: Math.max(0, Math.round((t.wordStarts[k] ?? 0) * FPS))})));
    out.push({spec, from, dur, groups, audioSrc: cont ? null : t.audioSrc});
  });
  return out;
};

/** Pro náhledy: [začátek, délka] každé scény ve snímcích. */
export const hybridSceneFrames = (props: HybridProps) => localize(props.script, props.lang, props.timeline).map((s) => [s.from, s.dur] as [number, number]);

export const calculateHybridMetadata: CalculateMetadataFunction<HybridProps> = ({props}) => {
  const sc = localize(props.script, props.lang, props.timeline);
  const last = sc[sc.length - 1];
  return {durationInFrames: Math.max(30, last.from + last.dur), fps: FPS};
};

/* ---------------- jedna scéna ---------------- */

const NO_POP = new Set(['table', 'waterPool', 'house', 'mountain', 'powerLine', 'goal']);

const HybridScene: React.FC<{s: HScene; index: number; prevProps: PropSpec[]; theme: Theme; lang: Lang; hook: string | null}> = ({s, index, prevProps, theme, lang, hook}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const {spec, dur} = s;
  const byId = new Map(spec.props.map((p) => [p.id, p]));
  const focusProp = byId.get(spec.camera.focus) ?? spec.props[0];
  const focus = focusProp ? propAnchorAt(focusProp, 0, dur) : ([0, 1, 0] as [number, number, number]);
  const shot = shotFromSpec(spec.camera, focus, fitItems(spec.props, dur));
  const hasCard = !!spec.card;
  // s kartou nebo háčkem nahoře se 3D svět posune níž a kamera trochu oddálí; jinak lehce nahoru, ať je místo na titulky
  const shiftY = hasCard ? 190 : hook ? 150 : -60;
  const zoomOut = hasCard ? 1.14 : 1;

  // kamera: rychlý nájezd po střihu, přiblížení na klíčová slova, jemná "ruční" kamera, otřes
  const base = cameraAt(shot, frame, dur);
  const dist = Math.hypot(base.position[0] - base.target[0], base.position[1] - base.target[1], base.position[2] - base.target[2]);
  const entry = 1 - Easing.out(Easing.cubic)(Math.min(1, frame / 9));
  const punches = s.groups.filter((g) => g.words.some((w) => w.hl)).map((g) => g.start + 1);
  const punch = punches.reduce((m, p) => {
    const t = frame - p;
    return Math.max(m, t < 0 ? 0 : t < 5 ? t / 5 : Math.exp(-(t - 5) / 12));
  }, 0);
  const hand = dist * 0.007;
  const shake = spec.shake ? Math.max(0, 1 - frame / 16) * dist * 0.03 : 0;
  const jx = Math.sin(frame * 0.047) * hand + Math.sin(frame * 1.9) * shake;
  const jy = Math.sin(frame * 0.039 + 1.3) * hand * 0.7 + Math.cos(frame * 2.3) * shake;
  const cam = {
    position: [base.position[0] + jx, base.position[1] + jy, base.position[2]] as [number, number, number],
    target: base.target,
    fov: base.fov * zoomOut * (1 + 0.16 * entry) * (1 - 0.07 * punch),
  };
  const cam0 = {...cameraAt(shot, 0, dur), fov: base.fov * zoomOut};

  // předměty, které v minulé scéně nebyly, naskočí s odrazem
  const prevKeys = new Set(prevProps.map((p) => `${p.id}:${p.type}`));
  let popIndex = 0;
  const popCfg = {damping: 9, stiffness: 190, mass: 0.55};
  const enters = spec.props.map((p) => {
    if (NO_POP.has(p.type) || prevKeys.has(`${p.id}:${p.type}`)) return {e: 1, st: 0};
    const d = 1 + popIndex++ * 3;
    const e = spring({frame: frame - d, fps, config: popCfg});
    const prev = spring({frame: frame - d - 1, fps, config: popCfg});
    return {e, st: Math.max(-0.28, Math.min(0.28, (e - prev) * 3.2))};
  });

  // ručně kreslené popisky: kotva sleduje předmět, popisek stojí na místě
  const noteSrc = spec.notes.filter((n) => byId.has(n.prop));
  const anchors0 = noteSrc.map((n) => {
    const p = projectToScreen(cam0, stableAnchorAt(byId.get(n.prop)!, 0, dur), width, height);
    return {x: p.x, y: p.y + shiftY};
  });
  const labels = placeNotes(anchors0, hasCard ? 830 : hook ? 720 : 330);
  const notes: NotePos[] = noteSrc.map((n, i) => {
    const p = projectToScreen(cam, stableAnchorAt(byId.get(n.prop)!, frame, dur), width, height);
    return {anchor: {x: p.x, y: p.y + shiftY}, label: labels[i], text: n.text[lang], delay: 6 + i * 10};
  });

  const accent = theme.accent;
  const zoom = 1 + entry * 0.07;
  return (
    <AbsoluteFill style={{background: skyFor(spec.environment, theme, index)}}>
      {s.audioSrc ? <Audio src={staticFile(s.audioSrc)} /> : null}
      {notes.map((n, i) => (
        <Sequence key={`pop${i}`} from={n.delay + 3} durationInFrames={20} layout="none">
          <Audio src={staticFile('sfx/pop.wav')} volume={0.4} />
        </Sequence>
      ))}
      {spec.card && (spec.card.type === 'counter' || spec.card.type === 'gauge') ? (
        <Sequence from={Math.round(Math.max(20, dur * 0.6))} durationInFrames={30} layout="none">
          <Audio src={staticFile('sfx/ding.wav')} volume={0.25} />
        </Sequence>
      ) : null}
      {spec.shake ? (
        <Sequence from={0} durationInFrames={40} layout="none">
          <Audio src={staticFile('sfx/boom.wav')} volume={0.35} />
        </Sequence>
      ) : null}

      <AbsoluteFill style={{transform: `translateY(${shiftY}px) scale(${zoom})`, filter: 'saturate(1.28) contrast(1.08)'}}>
        <ThreeCanvas width={width} height={height} shadows gl={{antialias: true}}>
          <CameraRig state={cam} />
          <Environment env={spec.environment} variant={index} theme={theme} />
          {spec.props.map((p, i) => (
            <Prop key={p.id} spec={p} frame={frame} duration={dur} enter={enters[i].e} stretch={enters[i].st} ground={spec.environment !== 'space'} />
          ))}
          {spec.flows.map((fl, i) =>
            byId.has(fl.from) && byId.has(fl.to) ? (
              <Flow key={i} kind={fl.kind} a={propAnchorAt(byId.get(fl.from)!, frame, dur)} b={propAnchorAt(byId.get(fl.to)!, frame, dur)} frame={frame} seed={i * 31} />
            ) : null,
          )}
          {spec.waves.map((w, i) => (byId.has(w.from) ? <Waves key={i} kind={w.kind} at={propAnchorAt(byId.get(w.from)!, frame, dur)} frame={frame} camPos={cam.position} /> : null))}
        </ThreeCanvas>
      </AbsoluteFill>

      {/* filmový tón + vinětace, ať titulky vyniknou */}
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(10,8,20,0.42) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(10,8,20,0.55) 100%)'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.32) 100%)'}} />

      {notes.map((n, i) => (
        <Note key={i} n={n} index={i} color={i === 0 ? '#FFFFFF' : accent} />
      ))}
      {spec.card ? <InfoCard v={spec.card} dur={dur} lang={lang} accent={accent} /> : null}
      {hook ? <Hook text={hook} accent={accent} dur={dur} /> : null}
      <Captions groups={s.groups} accent={accent} />
      {index === 0 ? <AbsoluteFill style={{background: '#ffffff', opacity: interpolate(frame, [0, 7], [0.85, 0], {extrapolateRight: 'clamp'})}} /> : null}
    </AbsoluteFill>
  );
};

/* ---------------- celé video ---------------- */

const Progress: React.FC<{total: number; color: string}> = ({total, color}) => {
  const f = useCurrentFrame();
  return (
    <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 9, background: 'rgba(0,0,0,0.25)'}}>
      <div style={{width: `${(f / Math.max(1, total - 1)) * 100}%`, height: '100%', background: color, boxShadow: `0 0 14px ${color}`}} />
    </div>
  );
};

export const HybridVideo: React.FC<HybridProps> = ({script, lang, timeline, music, musicVolume = 0.1}) => {
  const scenes = localize(script, lang, timeline);
  const theme = themeFor(script.id);
  const total = scenes[scenes.length - 1].from + scenes[scenes.length - 1].dur;
  const track = music === undefined ? theme.music : music;
  const musicVol = (f: number) => musicVolume * interpolate(f, [0, 12, total - 30, total - 1], [0.6, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const voice = timeline?.continuous && timeline.audioSrc ? timeline.audioSrc : null;
  return (
    <AbsoluteFill style={{background: '#101018'}}>
      {track ? <Audio src={staticFile(track)} loop volume={musicVol} /> : null}
      {voice ? <Audio src={staticFile(voice)} /> : null}
      <Sequence from={0} durationInFrames={45} layout="none">
        <Audio src={staticFile('sfx/boom.wav')} volume={0.5} />
      </Sequence>
      {scenes.slice(1).map((sc, i) => (
        <Sequence key={`w${i}`} from={Math.max(0, sc.from - 5)} durationInFrames={24} layout="none">
          <Audio src={staticFile('sfx/whoosh.wav')} volume={0.22} />
        </Sequence>
      ))}
      {scenes.map((sc, i) => (
        <Sequence key={i} from={sc.from} durationInFrames={sc.dur} name={`scena-${i + 1}`}>
          <HybridScene s={sc} index={i} prevProps={i > 0 ? scenes[i - 1].spec.props : []} theme={theme} lang={lang} hook={i === 0 ? script.hook[lang] : null} />
        </Sequence>
      ))}
      <Progress total={total} color={theme.accent} />
    </AbsoluteFill>
  );
};
