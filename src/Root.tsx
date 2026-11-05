import React from 'react';
import {Composition} from 'remotion';
import {Video} from './Video';
import {VIDEO, SCENES} from './config';
import {FyzikaVideo, calculateFyzikaMetadata, FPS, type FyzikaProps} from './engine/FyzikaVideo';
import {LANGS, type VideoScript} from './engine/schema';
import {ShortVideo, calculateShortMetadata, type ShortProps} from './v2/ShortVideo';
import type {ShortScript} from './v2/schema';
import {HybridVideo, calculateHybridMetadata, type HybridProps} from './v3/HybridVideo';
import type {HybridScript} from './v3/schema';
import sampleHybrid from '../content/scripts/019.json';
import sample from '../content/scripts/001.json';
import sampleShort from '../src/v2/sample.json';

const total = SCENES.reduce((sum, s) => sum + s.durationInFrames, 0);

export const RemotionRoot: React.FC = () => (
  <>
    {/* v3: hybridní krátká videa – 3D svět + karta + ručně kreslené popisky (videa 15+) */}
    {LANGS.map((lang) => (
      <Composition
        key={`h-${lang}`}
        id={`Hybrid-${lang}`}
        component={HybridVideo}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={30 * 25}
        defaultProps={{script: sampleHybrid as HybridScript, lang, timeline: null} satisfies HybridProps}
        calculateMetadata={calculateHybridMetadata}
      />
    ))}
    {/* v2: 2D "blueprint" engine (zůstává k dispozici) */}
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
