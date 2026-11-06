import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {CameraRig} from '../engine/EngineScene';
import {Prop} from '../engine/Props';
import {Flow, Waves} from '../engine/Effects';
import {fitItems, propAnchorAt, shotFromSpec, stableAnchorAt} from '../engine/anim';
import {estimateTimeline, spokenText, tokenize} from '../engine/localize';
import type {CameraSpec, Lang, PropSpec, SceneSpec as V1Scene, SceneTimeline, Timeline} from '../engine/schema';
import {cameraAt, projectToScreen} from '../three/camera';
import {CineEnvironment, Dust, cineSky, cineThemeFor, type CineTheme} from './cine';
import {Captions, EndCard, Hook, InfoCard, Note, groupWords, placeNotes, type CapGroup, type NotePos} from './overlays';
import type {HybridSceneSpec, HybridScript} from './schema';

export const FPS = 30;

type SegTimeline = SceneTimeline & {startSec?: number};
/** Časová osa: buď jeden souvislý hlas (continuous), nebo MP3 pro každou scénu. */
export type HybridTimeline = Timeline & {
  continuous?: boolean;
  audioSrc?: string | null;
  scenes: SegTimeline[];
  /** závěrečná výzva: buď uvnitř hlavního hlasu (startSec), nebo vlastní MP3 (audioSrc) */
  outro?: {text: string; startSec?: number; durationSec: number; wordStarts: number[]; audioSrc?: string | null} | null;
};

export type HybridProps = {
  script: HybridScript;
  lang: Lang;
  timeline: HybridTimeline | null;
  /** cesta k hudbě v public/; undefined = podle čísla videa, null = bez hudby */
  music?: string | null;
  musicVolume?: number;
  /** název dalšího dílu – ukáže se na závěrečné kartě */
  nextTitle?: string | null;
};

/** Hudba pro hybridní videa (generuje scripts/make-audio.ts): takt 17 = „drop“, na který video skočí v pointě. */
type Track = {src: string; dropSec?: number};
const dropOf = (bpm: number) => (16 * 4 * 60) / bpm;
const CINE_MUSIC: Track[] = [
  {src: 'music/cine-a.mp3', dropSec: dropOf(124)},
  {src: 'music/cine-b.mp3', dropSec: dropOf(140)},
  {src: 'music/cine-c.mp3', dropSec: dropOf(112)},
  {src: 'music/cine-d.mp3', dropSec: dropOf(120)},
];

type HScene = {spec: HybridSceneSpec; from: number; dur: number; groups: CapGroup[]; audioSrc: string | null; isOutro: boolean; inVoice?: boolean};

const words = (text: string, starts: number[]) =>
  groupWords(tokenize(text).map((w, k) => ({text: w.text, hl: w.highlight, start: Math.max(0, Math.round((starts[k] ?? 0) * FPS))})));

const localize = (script: HybridScript, lang: Lang, tl: HybridTimeline | null): HScene[] => {
  const cont = !!(tl?.continuous && tl.scenes.length === script.scenes.length);
  const tls: SegTimeline[] = script.scenes.map((sc, i) => (cont ? tl!.scenes[i] : tl?.scenes[i]) ?? estimateTimeline(sc as unknown as V1Scene, lang));
  const out: HScene[] = [];
  let cursor = 0;
  script.scenes.forEach((spec, i) => {
    const t = tls[i];
    let from: number;
    let dur: number;
    if (cont) {
      from = Math.round((t.startSec ?? 0) * FPS);
      const next = tls[i + 1];
      const end = next ? Math.round((next.startSec ?? 0) * FPS) : Math.round(((t.startSec ?? 0) + t.durationSec) * FPS);
      dur = Math.max(12, end - from);
    } else {
      from = cursor;
      dur = Math.max(Math.round(1.3 * FPS), Math.ceil((t.durationSec + 0.05) * FPS));
    }
    cursor = from + dur;
    out.push({spec, from, dur, groups: words(spec.narration[lang], t.wordStarts), audioSrc: cont ? null : t.audioSrc, isOutro: false});
  });

  // závěr „sleduj“: stejný svět jako poslední scéna, kamera odjíždí
  if (script.outro) {
    const last = script.scenes[script.scenes.length - 1];
    const spec: HybridSceneSpec = {
      ...last,
      // předměty zůstanou tam, kde poslední scéna skončila (žádné nové posouvání / mizení)
      props: last.props
        .filter((p) => p.anim !== 'vanish')
        .map((p) => (p.anim === 'slide' && p.slideTo ? {...p, position: p.slideTo, slideTo: null, anim: 'none' as const} : p)),
      narration: script.outro,
      notes: [],
      card: null,
      shake: false,
      flows: [],
      camera: {...last.camera, move: 'dollyOut'},
    };
    // namluvený závěr platí, jen když sedí na aktuální text
    const o = tl?.outro && tl.outro.text === spokenText(script.outro[lang]) ? tl.outro : null;
    let from = cursor;
    let audioSrc: string | null = null;
    let wordStarts: number[];
    let sec: number;
    const inVoice = !!(o && o.startSec !== undefined && cont);
    if (inVoice) {
      from = Math.round(o!.startSec! * FPS);
      wordStarts = o!.wordStarts;
      sec = o!.durationSec;
    } else if (o) {
      audioSrc = o.audioSrc ?? null;
      wordStarts = o.wordStarts;
      sec = o.durationSec;
    } else {
      const est = estimateTimeline({narration: script.outro} as unknown as V1Scene, lang);
      wordStarts = est.wordStarts;
      sec = est.durationSec;
    }
    out.push({spec, from, dur: Math.max(Math.round(2.6 * FPS), Math.ceil((sec + 0.6) * FPS)), groups: words(script.outro[lang], wordStarts), audioSrc, isOutro: true, inVoice});
  }
  return out;
};

export const calculateHybridMetadata: CalculateMetadataFunction<HybridProps> = ({props}) => {
  const sc = localize(props.script, props.lang, props.timeline);
  const last = sc[sc.length - 1];
  return {durationInFrames: Math.max(30, last.from + last.dur), fps: FPS};
};

/** Pro náhledy: [začátek, délka] každé scény ve snímcích. */
export const hybridSceneFrames = (props: HybridProps) => localize(props.script, props.lang, props.timeline).map((s) => [s.from, s.dur] as [number, number]);

/* ---------------- jedna scéna ---------------- */

const NO_POP = new Set(['table', 'waterPool', 'house', 'mountain', 'powerLine', 'goal']);
const NEXT_ANGLE: Record<CameraSpec['angle'], CameraSpec['angle']> = {front: 'frontRight', frontLeft: 'low', frontRight: 'frontLeft', side: 'frontRight', top: 'frontLeft', low: 'front'};

/** Kdy scénu "střihnout" na druhý záběr: u prvního klíčového slova, jinak v půlce. */
const cutFrame = (s: HScene) => {
  if (s.isOutro || s.dur < 54) return -1;
  const hl = s.groups.flatMap((g) => g.words.filter((w) => w.hl).map((w) => w.start));
  const cand = hl.find((f) => f >= s.dur * 0.28 && f <= s.dur * 0.72);
  return cand !== undefined ? Math.max(14, cand - 2) : Math.round(s.dur * 0.5);
};

const HybridScene: React.FC<{s: HScene; index: number; prevProps: PropSpec[]; th: CineTheme; lang: Lang; hook: string | null; nextTitle: string | null; isPayoff: boolean}> = ({
  s,
  index,
  prevProps,
  th,
  lang,
  hook,
  nextTitle,
  isPayoff,
}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const {spec, dur, isOutro} = s;
  const byId = new Map(spec.props.map((p) => [p.id, p]));
  const focusProp = byId.get(spec.camera.focus) ?? spec.props[0];
  const focus = focusProp ? propAnchorAt(focusProp, 0, dur) : ([0, 1, 0] as [number, number, number]);
  const hasCard = !!spec.card;
  const shiftY = hasCard ? 190 : hook ? 150 : isOutro ? 0 : -60;
  const zoomOut = hasCard ? 1.14 : 1;

  // dva záběry: celek, pak u klíčového slova střih na detail z jiného úhlu
  const cut = cutFrame(s);
  const shotA = shotFromSpec(spec.camera, focus, fitItems(spec.props, dur));
  const keyIds = new Set([
    spec.camera.focus,
    ...spec.notes.map((n) => n.prop),
    ...spec.flows.flatMap((f) => [f.from, f.to]),
    ...spec.waves.map((w) => w.from),
    // šokovaná postavička musí být i v detailu
    ...spec.props.filter((p) => p.anim === 'shock').map((p) => p.id),
  ]);
  const keyItems = fitItems(spec.props.filter((p) => keyIds.has(p.id)), dur);
  const camB: CameraSpec = {...spec.camera, angle: NEXT_ANGLE[spec.camera.angle] ?? 'front', distance: spec.camera.distance * 0.68, move: spec.camera.move === 'dollyIn' ? 'orbitLeft' : 'dollyIn'};
  const shotB = cut > 0 ? shotFromSpec(camB, focus, keyItems.length ? keyItems : fitItems(spec.props, dur)) : shotA;
  const inB = cut > 0 && frame >= cut;
  const local = inB ? frame - cut : frame;
  const shotLen = cut > 0 ? (inB ? dur - cut : cut) : dur;
  const base = cameraAt(inB ? shotB : shotA, local, shotLen);

  // nájezd po každém střihu, přiblížení na klíčová slova, "ruční" kamera, otřes
  const dist = Math.hypot(base.position[0] - base.target[0], base.position[1] - base.target[1], base.position[2] - base.target[2]);
  const entry = 1 - Easing.out(Easing.cubic)(Math.min(1, local / 8));
  const punches = s.groups.flatMap((g) => g.words.filter((w) => w.hl).map((w) => w.start + 1));
  const punch = punches.reduce((m, p) => {
    const t = frame - p;
    return Math.max(m, t < 0 ? 0 : t < 4 ? t / 4 : Math.exp(-(t - 4) / 10));
  }, 0);
  const hand = dist * 0.008;
  const shake = spec.shake ? Math.max(0, 1 - local / 16) * dist * 0.035 : 0;
  const jx = Math.sin(frame * 0.047) * hand + Math.sin(frame * 1.9) * shake;
  const jy = Math.sin(frame * 0.039 + 1.3) * hand * 0.7 + Math.cos(frame * 2.3) * shake;
  const cam = {
    position: [base.position[0] + jx, base.position[1] + jy, base.position[2]] as [number, number, number],
    target: base.target,
    fov: base.fov * zoomOut * (1 + 0.18 * entry) * (1 - 0.09 * punch),
  };
  const notesFrom = inB ? cut : 0;
  const camStart = {...cameraAt(inB ? shotB : shotA, 0, shotLen), fov: base.fov * zoomOut};

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

  // ručně kreslené popisky: ve druhém záběru (detail), jinak od začátku
  const noteSrc = spec.notes.filter((n) => byId.has(n.prop));
  const anchors0 = noteSrc.map((n) => {
    const p = projectToScreen(camStart, stableAnchorAt(byId.get(n.prop)!, notesFrom, dur), width, height);
    return {x: p.x, y: p.y + shiftY};
  });
  const labels = placeNotes(anchors0, hasCard ? 830 : hook ? 720 : 330);
  const noteDelay0 = cut > 0 ? cut + 5 : 6;
  const notes: NotePos[] = noteSrc.map((n, i) => {
    const p = projectToScreen(cam, stableAnchorAt(byId.get(n.prop)!, frame, dur), width, height);
    return {anchor: {x: p.x, y: p.y + shiftY}, label: labels[i], text: n.text[lang], delay: noteDelay0 + i * 9};
  });
  const showNotes = cut < 0 || inB;

  const accent = th.accent;
  const zoom = 1 + entry * 0.08;
  const outroBlur = isOutro ? interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'}) : 0;
  // rychlý „zoom blur“ při nástupu scény a při střihu na detail
  const whip = Math.max(index > 0 ? Math.max(0, 1 - frame / 5) * 9 : 0, cut > 0 && frame >= cut ? Math.max(0, 1 - (frame - cut) / 4) * 6 : 0);
  const tapAt = Math.max(34, Math.round(dur * 0.55));
  return (
    <AbsoluteFill style={{background: cineSky(spec.environment, th, index)}}>
      {s.audioSrc ? <Audio src={staticFile(s.audioSrc)} /> : null}
      {/* zvuky: švih u střihu, rána u klíčových slov, ťuknutí u popisků */}
      {cut > 0 ? (
        <Sequence from={Math.max(0, cut - 3)} durationInFrames={20} layout="none">
          <Audio src={staticFile('sfx/swish.wav')} volume={0.32} />
        </Sequence>
      ) : null}
      {(spec.shake || isPayoff ? [] : punches.slice(0, 1)).map((p, i) => (
        <Sequence key={`hit${i}`} from={Math.max(0, p - 1)} durationInFrames={24} layout="none">
          <Audio src={staticFile('sfx/hit.wav')} volume={0.3} />
        </Sequence>
      ))}
      {notes.map((n, i) => (
        <Sequence key={`pop${i}`} from={n.delay + 3} durationInFrames={20} layout="none">
          <Audio src={staticFile('sfx/pop.wav')} volume={0.35} />
        </Sequence>
      ))}
      {spec.card ? (
        <Sequence from={2} durationInFrames={24} layout="none">
          <Audio src={staticFile('sfx/swish.wav')} volume={0.2} />
        </Sequence>
      ) : null}
      {spec.card && (spec.card.type === 'counter' || spec.card.type === 'gauge') ? (
        <Sequence from={Math.round(Math.max(20, dur * 0.6))} durationInFrames={30} layout="none">
          <Audio src={staticFile('sfx/ding.wav')} volume={0.22} />
        </Sequence>
      ) : null}
      {spec.shake ? (
        <Sequence from={0} durationInFrames={40} layout="none">
          <Audio src={staticFile('sfx/boom.wav')} volume={0.4} />
        </Sequence>
      ) : null}
      {isOutro ? (
        <>
          <Sequence from={2} durationInFrames={60} layout="none">
            <Audio src={staticFile('sfx/sparkle.wav')} volume={0.35} />
          </Sequence>
          <Sequence from={tapAt - 1} durationInFrames={20} layout="none">
            <Audio src={staticFile('sfx/tap.wav')} volume={0.5} />
          </Sequence>
        </>
      ) : null}

      <AbsoluteFill
        style={{
          transform: `translateY(${shiftY}px) scale(${zoom})`,
          filter: `saturate(1.25) contrast(1.1) blur(${outroBlur * 7 + whip}px) brightness(${1 - outroBlur * 0.45})`,
        }}
      >
        <ThreeCanvas width={width} height={height} shadows gl={{antialias: true}}>
          <CameraRig state={cam} />
          <CineEnvironment env={spec.environment} variant={index} th={th} />
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

      {/* filmový tón: vinětace, tmavší okraje, prach ve vzduchu */}
      <Dust color={th.flash} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(6,4,16,0.5) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(6,4,16,0.6) 100%)'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)'}} />
      {/* bílý záblesk při střihu */}
      {cut > 0 ? <AbsoluteFill style={{background: '#ffffff', opacity: interpolate(frame, [cut, cut + 4], [0.28, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}} /> : null}

      {showNotes ? notes.map((n, i) => <Note key={i} n={n} index={i} color={i === 0 ? '#FFFFFF' : accent} />) : null}
      {spec.card ? <InfoCard v={spec.card} dur={dur} lang={lang} accent={accent} /> : null}
      {hook ? <Hook text={hook} accent={accent} dur={dur} /> : null}
      {isOutro ? <EndCard lang={lang} accent={accent} dur={dur} nextTitle={nextTitle} avatar={staticFile(`brand/avatar-${lang}.jpg`)} tapAt={tapAt} /> : <Captions groups={s.groups} accent={accent} />}
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

export const HybridVideo: React.FC<HybridProps> = ({script, lang, timeline, music, musicVolume = 0.13, nextTitle = null}) => {
  const scenes = localize(script, lang, timeline);
  const th = cineThemeFor(script.id);
  const total = scenes[scenes.length - 1].from + scenes[scenes.length - 1].dur;
  const track: Track | null = music === undefined ? CINE_MUSIC[script.id % CINE_MUSIC.length] : music ? {src: music} : null;
  const voice = timeline?.continuous && timeline.audioSrc ? timeline.audioSrc : null;
  // pointa = poslední obsahová scéna: před ní „náběh“, pak ticho a s ránou naskočí hudba od dropu
  const content = scenes.filter((x) => !x.isOutro);
  const payoff = content[content.length - 1];
  const dropAt = payoff && payoff.from > 60 ? payoff.from : -1;
  const outro = scenes.find((x) => x.isOutro);
  // závěr namluvený zvlášť (nebo vůbec): hlavní hlas utneme, ať nezazní starý text
  const voiceEnd = outro && !outro.inVoice ? outro.from : total;
  const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
  const preVol = (f: number) =>
    musicVolume * interpolate(f, [0, 10], [0.7, 1], clamp) * (dropAt > 0 ? interpolate(f, [dropAt - 16, dropAt - 4, dropAt - 1], [1, 0.3, 0], clamp) : 1) * interpolate(f, [total - 24, total - 1], [1, 0], clamp);
  const postVol = (f: number) => musicVolume * 1.1 * interpolate(f + dropAt, [total - 24, total - 1], [1, 0], clamp);
  return (
    <AbsoluteFill style={{background: '#0b0a18'}}>
      {track ? (
        <Sequence from={0} durationInFrames={dropAt > 0 ? dropAt : total} layout="none">
          <Audio src={staticFile(track.src)} loop volume={preVol} />
        </Sequence>
      ) : null}
      {track && dropAt > 0 ? (
        <Sequence from={dropAt} layout="none">
          <Audio src={staticFile(track.src)} trimBefore={track.dropSec ? Math.round(track.dropSec * FPS) : 0} loop volume={postVol} />
        </Sequence>
      ) : null}
      {voice ? (
        <Sequence from={0} durationInFrames={voiceEnd} layout="none">
          <Audio src={staticFile(voice)} />
        </Sequence>
      ) : null}
      <Sequence from={0} durationInFrames={45} layout="none">
        <Audio src={staticFile('sfx/boom.wav')} volume={0.5} />
      </Sequence>
      {dropAt > 0 ? (
        <>
          <Sequence from={dropAt - 42} durationInFrames={44} layout="none">
            <Audio src={staticFile('sfx/riser.wav')} volume={0.3} />
          </Sequence>
          <Sequence from={dropAt} durationInFrames={40} layout="none">
            <Audio src={staticFile('sfx/hit.wav')} volume={0.45} />
          </Sequence>
        </>
      ) : null}
      {scenes.slice(1).map((sc, i) => (
        <Sequence key={`w${i}`} from={Math.max(0, sc.from - 5)} durationInFrames={24} layout="none">
          <Audio src={staticFile('sfx/whoosh.wav')} volume={0.24} />
        </Sequence>
      ))}
      {scenes.map((sc, i) => (
        <Sequence key={i} from={sc.from} durationInFrames={sc.dur} name={sc.isOutro ? 'zaver' : `scena-${i + 1}`}>
          <HybridScene
            s={sc}
            index={i}
            prevProps={i > 0 ? scenes[i - 1].spec.props : []}
            th={th}
            lang={lang}
            hook={i === 0 ? script.hook[lang] : null}
            nextTitle={nextTitle}
            isPayoff={sc === payoff && dropAt > 0}
          />
        </Sequence>
      ))}
      <Progress total={total} color={th.accent} />
    </AbsoluteFill>
  );
};
