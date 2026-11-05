import React, {useLayoutEffect} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import type {PerspectiveCamera} from 'three';
import type {CameraShot, SceneConfig} from './types';
import {applyCamera, cameraAt, projectToScreen} from './three/camera';
import {World} from './three/World';
import {Titulek} from './components/Titulek';
import {Pocitadlo} from './components/Pocitadlo';
import {Stitek} from './components/Stitek';

const CameraRig: React.FC<{shot: CameraShot; duration: number}> = ({shot, duration}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const state = cameraAt(shot, frame, duration);
  useLayoutEffect(() => applyCamera(camera, state, width / height));
  useFrame(() => applyCamera(camera, state, width / height));
  return null;
};

export const Scene: React.FC<{scene: SceneConfig}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const cam = cameraAt(scene.camera, frame, scene.durationInFrames);
  const flash = interpolate(frame, [0, 6], [0.7, 0], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill>
      <ThreeCanvas width={width} height={height} shadows gl={{antialias: true}}>
        <CameraRig shot={scene.camera} duration={scene.durationInFrames} />
        <World effects={scene.effects} sceneFrame={frame} />
      </ThreeCanvas>

      {/* jemná vinětace pro čitelnost textu */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(60,25,0,0.28) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 62%, rgba(40,15,0,0.45) 100%)',
        }}
      />

      {scene.labels.map((l, i) => {
        const p = projectToScreen(cam, l.target, width, height);
        return <Stitek key={i} emoji={l.emoji} text={l.text} x={p.x} y={p.y} offset={l.offset} delay={l.delay} />;
      })}

      {scene.counter ? <Pocitadlo {...scene.counter} /> : null}
      <Titulek captions={scene.captions} durationInFrames={scene.durationInFrames} />

      <AbsoluteFill style={{background: '#fff3dc', opacity: flash}} />
    </AbsoluteFill>
  );
};
