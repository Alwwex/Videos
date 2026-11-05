import React from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Sequence, Series, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import {EngineScene} from './EngineScene';
import {SERIES_TITLE, localize} from './localize';
import type {Lang, Timeline, VideoScript} from './schema';
import {themeFor} from './themes';

export const FPS = 30;

export type FyzikaProps = {
  script: VideoScript;
  lang: Lang;
  /** Časová osa z TTS; null = odhad bez zvuku */
  timeline: Timeline | null;
  /** Cesta k hudbě v public/; undefined = smyčka podle tématu, null = bez hudby */
  music?: string | null;
  musicVolume?: number;
};

export const calculateFyzikaMetadata: CalculateMetadataFunction<FyzikaProps> = ({props}) => {
  const scenes = localize(props.script, props.lang, props.timeline, FPS);
  return {durationInFrames: scenes.reduce((n, s) => n + s.durationInFrames, 0), fps: FPS};
};

const ProgressBar: React.FC<{colors: [string, string]}> = ({colors}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return (
    <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 14, background: 'rgba(20,12,4,0.35)'}}>
      <div
        style={{
          width: `${(frame / Math.max(1, durationInFrames - 1)) * 100}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
          boxShadow: `0 0 18px ${colors[0]}`,
        }}
      />
    </div>
  );
};

export const FyzikaVideo: React.FC<FyzikaProps> = ({script, lang, timeline, music, musicVolume = 0.11}) => {
  const scenes = localize(script, lang, timeline, FPS);
  const theme = themeFor(script.id);
  const track = music === undefined ? theme.music : music;
  const total = scenes.reduce((n, s) => n + s.durationInFrames, 0);
  const starts = scenes.map((_, i) => scenes.slice(0, i).reduce((n, s) => n + s.durationInFrames, 0));
  // hudba plynule naběhne a na konci dozní
  const musicVol = (f: number) =>
    musicVolume * interpolate(f, [0, 20, total - 45, total - 1], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: '#ffd9a3'}}>
      {track ? <Audio src={staticFile(track)} loop volume={musicVol} /> : null}
      {/* whoosh začíná pár snímků PŘED střihem, jak se to dělá ve střižně */}
      {starts.slice(1).map((st, i) => (
        <Sequence key={`w${i}`} from={Math.max(0, st - 6)} durationInFrames={30} layout="none">
          <Audio src={staticFile('sfx/whoosh.wav')} volume={0.3} />
        </Sequence>
      ))}
      <Series>
        {scenes.map((s, i) => (
          <Series.Sequence key={i} durationInFrames={s.durationInFrames} name={`scena-${i + 1}`}>
            <EngineScene scene={s} index={i} prevProps={i > 0 ? scenes[i - 1].spec.props : []} title={script.title[lang]} theme={theme} isLast={i === scenes.length - 1} lang={lang} />
          </Series.Sequence>
        ))}
      </Series>
      <ProgressBar colors={theme.bar} />
      <div style={{position: 'absolute', top: 90, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <div
          style={{
            padding: '14px 34px',
            borderRadius: 999,
            background: 'rgba(20,12,4,0.75)',
            color: '#FFFFFF',
            fontFamily: theme.font,
            fontWeight: 800,
            fontSize: 40,
            letterSpacing: 1,
          }}
        >
          {SERIES_TITLE[lang]}
        </div>
      </div>
    </AbsoluteFill>
  );
};
