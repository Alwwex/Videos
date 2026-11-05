import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Easing, Sequence, Series, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {buildCaptions, estimateTimeline, tokenize, type Caption} from '../engine/localize';
import type {Lang, SceneSpec as V1Scene, SceneTimeline, Timeline} from '../engine/schema';
import type {SceneSpec, ShortScript} from './schema';
import {BODY_FONT, HEAD_FONT, MONO_FONT, MUSIC, themeFor, type Theme} from './theme';
import {Visual} from './visuals';

export const FPS = 30;

export type ShortProps = {
  script: ShortScript;
  lang: Lang;
  timeline: Timeline | null;
  /** cesta k hudbě v public/; undefined = smyčka podle čísla videa, null = bez hudby */
  music?: string | null;
  musicVolume?: number;
  /** název dalšího dílu (ukáže se v závěru) */
  nextTitle?: string | null;
};

export const SERIES: Record<Lang, string> = {cs: 'FYZIKA KOLEM TEBE', en: 'PHYSICS AROUND YOU', ro: 'FIZICA DIN JURUL TĂU'};
const FOLLOW: Record<Lang, string> = {cs: 'SLEDOVAT', en: 'FOLLOW', ro: 'URMĂREȘTE'};
const NEXT: Record<Lang, string> = {cs: 'Příští díl', en: 'Next episode', ro: 'Episodul următor'};

type RScene = {spec: SceneSpec; dur: number; audioSrc: string | null; captions: Caption[]};

const localizeShort = (script: ShortScript, lang: Lang, timeline: Timeline | null): RScene[] =>
  script.scenes.map((spec, i) => {
    const tl: SceneTimeline = timeline?.scenes[i] ?? estimateTimeline(spec as unknown as V1Scene, lang);
    const words = tokenize(spec.narration[lang]);
    const minSec = spec.visual.type === 'outro' ? 2.8 : spec.visual.type === 'quiz' ? 3.2 : 1.7;
    return {
      spec,
      dur: Math.max(Math.round(minSec * FPS), Math.ceil((tl.durationSec + 0.12) * FPS)),
      audioSrc: tl.audioSrc,
      captions: buildCaptions(words, tl.wordStarts, FPS),
    };
  });

export const calculateShortMetadata: CalculateMetadataFunction<ShortProps> = ({props}) => ({
  durationInFrames: localizeShort(props.script, props.lang, props.timeline).reduce((n, s) => n + s.dur, 0),
  fps: FPS,
});

/* ---------- pozadí ---------- */
const Background: React.FC<{th: Theme}> = ({th}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: th.bg}}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${th.grid} 2px, transparent 2px), linear-gradient(90deg, ${th.grid} 2px, transparent 2px), linear-gradient(${th.grid} 1px, transparent 1px), linear-gradient(90deg, ${th.grid} 1px, transparent 1px)`,
          backgroundSize: '180px 180px, 180px 180px, 36px 36px, 36px 36px',
          backgroundPosition: `${-f * 0.3}px ${-f * 0.5}px`,
          opacity: 0.9,
        }}
      />
      <AbsoluteFill style={{background: th.dark ? 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)' : 'radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(80,60,20,0.12) 100%)'}} />
    </AbsoluteFill>
  );
};

/* ---------- hlavička + ukazatel scén ---------- */
const Header: React.FC<{th: Theme; lang: Lang; starts: number[]; total: number; ac: string}> = ({th, lang, starts, total, ac}) => {
  const f = useCurrentFrame();
  let idx = 0;
  starts.forEach((s, i) => {
    if (f >= s) idx = i;
  });
  const n = starts.length;
  return (
    <>
      <div style={{position: 'absolute', top: 78, left: 64, right: 64, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <div style={{width: 16, height: 16, borderRadius: 4, background: ac}} />
          <div style={{fontFamily: MONO_FONT, fontWeight: 600, fontSize: 28, letterSpacing: 4, color: th.ink}}>{SERIES[lang]}</div>
        </div>
        <div style={{fontFamily: MONO_FONT, fontWeight: 600, fontSize: 28, letterSpacing: 3, color: th.muted, fontVariantNumeric: 'tabular-nums'}}>
          {String(idx + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
        </div>
      </div>
      <div style={{position: 'absolute', top: 132, left: 64, right: 64, display: 'flex', gap: 8}}>
        {starts.map((s, i) => {
          const end = starts[i + 1] ?? total;
          const p = Math.max(0, Math.min(1, (f - s) / Math.max(1, end - s)));
          return (
            <div key={i} style={{flex: 1, height: 6, borderRadius: 3, background: th.dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)', overflow: 'hidden'}}>
              <div style={{width: `${p * 100}%`, height: '100%', background: i === idx ? ac : th.muted}} />
            </div>
          );
        })}
      </div>
    </>
  );
};

/* ---------- velký nadpis ---------- */
const Headline: React.FC<{text: string; th: Theme; ac: string}> = ({text, th, ac}) => {
  const f = useCurrentFrame();
  const lines = text.split('|').map((l) => l.trim()).filter(Boolean).slice(0, 2);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const size = Math.min(108, Math.floor(1330 / longest));
  let k = 0;
  return (
    <div style={{position: 'absolute', top: 186, left: 50, right: 50, height: 230, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
      {lines.map((line, li) => (
        <div key={li} style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: size * 0.28, lineHeight: 1.02}}>
          {line.split(/\s+/).map((w, wi) => {
            const d = k++ * 2.5;
            const t = interpolate(f, [d, d + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
            return (
              <div key={wi} style={{overflow: 'hidden', paddingBottom: 6}}>
                <div
                  style={{
                    fontFamily: HEAD_FONT,
                    fontWeight: 900,
                    fontSize: size,
                    letterSpacing: 0.5,
                    color: li === 1 || lines.length === 1 ? (li === 1 ? ac : th.ink) : th.ink,
                    transform: `translateY(${(1 - t) * 105}%)`,
                    textShadow: th.dark ? `0 0 40px ${li === 1 ? ac + '55' : 'transparent'}` : 'none',
                  }}
                >
                  {w}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/* ---------- panel s diagramem ---------- */
const PANEL = {left: 60, top: 450, width: 960, height: 870};

const Panel: React.FC<{th: Theme; tag: string | null; ac: string; index: number; children: React.ReactNode; dur: number; first: boolean}> = ({th, tag, ac, index, children, dur, first}) => {
  const f = useCurrentFrame();
  const enter = interpolate(f, [0, 9], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const exit = interpolate(f, [dur - 5, dur], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', ...PANEL}}>
      {tag ? (
        <div style={{position: 'absolute', top: 26, left: 32, display: 'flex', alignItems: 'center', gap: 12, opacity: enter}}>
          <div style={{width: 12, height: 12, background: ac}} />
          <div style={{fontFamily: MONO_FONT, fontWeight: 600, fontSize: 25, letterSpacing: 3, color: th.muted, textTransform: 'uppercase'}}>{tag}</div>
        </div>
      ) : null}
      <div style={{position: 'absolute', top: 26, right: 32, fontFamily: MONO_FONT, fontWeight: 500, fontSize: 22, letterSpacing: 3, color: th.muted, opacity: 0.7 * enter}}>
        FIG. {String(index + 1).padStart(2, '0')}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 30,
          top: 84,
          width: 900,
          height: 760,
          opacity: Math.min(enter, exit),
          transform: `translateY(${(1 - enter) * (first ? 40 : 24)}px) scale(${0.97 + 0.03 * enter})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const PanelFrame: React.FC<{th: Theme; ac: string}> = ({th, ac}) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [0, 12], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const c = 46;
  const corner = (style: React.CSSProperties) => <div style={{position: 'absolute', width: c, height: c, borderColor: ac, borderStyle: 'solid', borderWidth: 0, ...style}} />;
  return (
    <div style={{position: 'absolute', ...PANEL, opacity: t, transform: `scale(${0.96 + 0.04 * t})`}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 30, background: th.panel, border: `2px solid ${th.panelBorder}`, boxShadow: th.dark ? '0 30px 80px rgba(0,0,0,0.35)' : '0 20px 60px rgba(60,40,10,0.12)'}} />
      {corner({top: -6, left: -6, borderTopWidth: 6, borderLeftWidth: 6, borderTopLeftRadius: 30})}
      {corner({top: -6, right: -6, borderTopWidth: 6, borderRightWidth: 6, borderTopRightRadius: 30})}
      {corner({bottom: -6, left: -6, borderBottomWidth: 6, borderLeftWidth: 6, borderBottomLeftRadius: 30})}
      {corner({bottom: -6, right: -6, borderBottomWidth: 6, borderRightWidth: 6, borderBottomRightRadius: 30})}
    </div>
  );
};

/* ---------- titulky (karaoke po slovech) ---------- */
const Subtitles: React.FC<{captions: Caption[]; th: Theme; ac: string}> = ({captions, th, ac}) => {
  const f = useCurrentFrame();
  if (!captions.length) return null;
  let idx = 0;
  captions.forEach((c, i) => {
    if (f >= c.start - 2) idx = i;
  });
  const cap = captions[idx];
  const words: {text: string; hl: boolean}[] = [];
  let hl = false;
  for (const raw of cap.text.split(/\s+/)) {
    if (raw.startsWith('*')) hl = true;
    words.push({text: raw.replace(/\*/g, ''), hl});
    if (raw.replace(/[.,!?;:…"“”]+$/, '').endsWith('*')) hl = false;
  }
  return (
    <div style={{position: 'absolute', left: 70, right: 70, top: 1372, display: 'flex', flexWrap: 'wrap', columnGap: 18, rowGap: 4}}>
      {words.map((w, i) => {
        const ws = cap.wordStarts[i] ?? cap.start;
        const t = interpolate(f, [ws - 3, ws + 3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <span
            key={`${idx}-${i}`}
            style={{
              fontFamily: BODY_FONT,
              fontWeight: 800,
              fontSize: 62,
              lineHeight: 1.15,
              color: w.hl ? ac : th.ink,
              opacity: 0.22 + 0.78 * t,
              transform: `translateY(${(1 - t) * 10}px)`,
              display: 'inline-block',
              textShadow: th.dark ? '0 3px 18px rgba(0,0,0,0.5)' : 'none',
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

export const ShortVideo: React.FC<ShortProps> = ({script, lang, timeline, music, musicVolume = 0.1, nextTitle}) => {
  const {fps} = useVideoConfig();
  const th = themeFor(script.id);
  const scenes = localizeShort(script, lang, timeline);
  const total = scenes.reduce((n, s) => n + s.dur, 0);
  const starts = scenes.map((_, i) => scenes.slice(0, i).reduce((n, s) => n + s.dur, 0));
  const track = music === undefined ? MUSIC[script.id % MUSIC.length] : music;
  const musicVol = (f: number) => musicVolume * interpolate(f, [0, 15, total - 40, total - 1], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Background th={th} />
      {track ? <Audio src={staticFile(track)} loop volume={musicVol} /> : null}
      {starts.slice(1).map((st, i) => (
        <Sequence key={`w${i}`} from={Math.max(0, st - 4)} durationInFrames={24} layout="none">
          <Audio src={staticFile('sfx/whoosh.wav')} volume={0.16} />
        </Sequence>
      ))}
      <PanelFrame th={th} ac={th.accents[scenes[0]?.spec.accent ?? 'yellow']} />
      <Series>
        {scenes.map((s, i) => {
          const ac = th.accents[s.spec.accent];
          return (
            <Series.Sequence key={i} durationInFrames={s.dur} name={`scena-${i + 1}-${s.spec.visual.type}`}>
              {s.audioSrc ? <Audio src={staticFile(s.audioSrc)} /> : null}
              <Headline text={s.spec.headline[lang]} th={th} ac={ac} />
              <Panel th={th} tag={s.spec.tag} ac={ac} index={i} dur={s.dur} first={i === 0}>
                <SceneVisual s={s} th={th} lang={lang} ac={ac} fps={fps} nextTitle={nextTitle} />
              </Panel>
              <Subtitles captions={s.captions} th={th} ac={ac} />
            </Series.Sequence>
          );
        })}
      </Series>
      <HeaderWrap th={th} lang={lang} starts={starts} total={total} scenes={scenes} />
    </AbsoluteFill>
  );
};

const HeaderWrap: React.FC<{th: Theme; lang: Lang; starts: number[]; total: number; scenes: RScene[]}> = ({th, lang, starts, total, scenes}) => {
  const f = useCurrentFrame();
  let idx = 0;
  starts.forEach((s, i) => {
    if (f >= s) idx = i;
  });
  return <Header th={th} lang={lang} starts={starts} total={total} ac={th.accents[scenes[idx]?.spec.accent ?? 'yellow']} />;
};

const SceneVisual: React.FC<{s: RScene; th: Theme; lang: Lang; ac: string; fps: number; nextTitle?: string | null}> = ({s, th, lang, ac, fps, nextTitle}) => {
  const f = useCurrentFrame();
  return (
    <Visual
      v={s.spec.visual}
      f={f}
      dur={s.dur}
      fps={fps}
      th={th}
      lang={lang}
      ac={ac}
      nextTitle={nextTitle}
      seriesTitle={SERIES[lang]}
      followText={FOLLOW[lang]}
      nextLabel={NEXT[lang]}
    />
  );
};
