import React from 'react';
import {Composition} from 'remotion';
import {Video} from './Video';
import {VIDEO, SCENES} from './config';
import {FyzikaVideo, calculateFyzikaMetadata, FPS, type FyzikaProps} from './engine/FyzikaVideo';
import {LANGS, type VideoScript} from './engine/schema';
import sample from '../content/scripts/001.json';

const total = SCENES.reduce((sum, s) => sum + s.durationInFrames, 0);

export const RemotionRoot: React.FC = () => (
  <>
    {/* Série "Fyzika kolem tebe" – jedna kompozice, jazyk a scénář přichází v props */}
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
