import {Easing, interpolate} from 'remotion';
import {PerspectiveCamera, Vector3} from 'three';
import type {CameraShot, Vec3} from '../types';

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Deterministický stav kamery pro daný snímek – sdílí ho 3D scéna i 2D štítky. */
export const cameraAt = (shot: CameraShot, frame: number, duration: number) => {
  const t = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.33, 0.1, 0.45, 1),
  });
  return {
    position: lerp3(shot.from.position, shot.to.position, t),
    target: lerp3(shot.from.target, shot.to.target, t),
    fov: shot.fov,
  };
};

export const applyCamera = (
  camera: PerspectiveCamera,
  state: ReturnType<typeof cameraAt>,
  aspect: number,
) => {
  camera.position.set(...state.position);
  camera.fov = state.fov;
  camera.aspect = aspect;
  camera.near = 0.1;
  camera.far = 200;
  camera.lookAt(...state.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
};

const helper = new PerspectiveCamera();
const v = new Vector3();

/** Promítne bod ze 3D světa na pixely obrazovky. */
export const projectToScreen = (
  state: ReturnType<typeof cameraAt>,
  point: Vec3,
  width: number,
  height: number,
) => {
  applyCamera(helper, state, width / height);
  v.set(...point).project(helper);
  return {x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height};
};
