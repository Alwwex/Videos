import React from 'react';
import {Composition} from 'remotion';
import {Video} from './Video';
import {VIDEO, SCENES} from './config';
import {FyzikaVideo, calculateFyzikaMetadata, FPS, type FyzikaProps} from './engine/FyzikaVideo';
import {LANGS, type VideoScript} from './engine/schema';
import {ShortVideo, calculateShortMetadata, type ShortProps} from './v2/ShortVideo';
import type {ShortScript} from './v2/schema';
import sample from '../content/scripts/001.json';
import sampleShort from '../content/scripts/015.json';

const total = SCENES.reduce((sum, s) => sum + s.durationInFrames, 0);

export const RemotionRoot: React.FC = () => (
  <>
    {/* v2: krátká 2D "blueprint" videa (~30 s) – videa 15+ */}
    {LANGS.map((lang) => (
      <Composition
        key={`s-${lang}`}
        id={`Short-${lang}`}
        component={ShortVideo}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={30 * 30}
        defaultProps={{script: sampleShort as ShortScript, lang, timeline: null, nextTitle: 'Proč je západ slunce červený'} satisfies ShortProps}
        calculateMetadata={calculateShortMetadata}
      />
    ))}
    {/* v1: 3D videa 1–14 (zůstávají beze změny) */}
    {LANGS.map((lang) => (
      <Composition
        key={lang}
        id={`Fyzika-${lang}`}
        component={FyzikaVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={FPS * 60}
        defaultProps={{script: sample as VideoScript, lang, timeline: null} satisfies FyzikaProps}
        calculateMetadata={calculateFyzikaMetadata}
      />
    ))}
    {/* Původní 15s demo */}
    <Composition
      id="SolarniPanely"
      component={Video}
      durationInFrames={total}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  </>
);
