import React from 'react';
import {AbsoluteFill, Series} from 'remotion';
import {SCENES, VIDEO} from './config';
import {Scene} from './Scene';
import {fontFamily} from './fonts';

export const Video: React.FC = () => (
  <AbsoluteFill style={{background: 'linear-gradient(180deg, #ffb46e 0%, #ffd9a3 45%, #ffe9c4 100%)'}}>
    <Series>
      {SCENES.map((scene) => (
        <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames} name={scene.id}>
          <Scene scene={scene} />
        </Series.Sequence>
      ))}
    </Series>
    <div
      style={{
        position: 'absolute',
        top: 90,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          padding: '14px 34px',
          borderRadius: 999,
          background: 'rgba(20,12,4,0.75)',
          color: '#FFFFFF',
          fontFamily,
          fontWeight: 800,
          fontSize: 40,
          letterSpacing: 1,
        }}
      >
        {VIDEO.title}
      </div>
    </div>
  </AbsoluteFill>
);
