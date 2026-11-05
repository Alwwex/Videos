import type {SceneConfig} from './types';

/* ============================================================
 *  KONFIGURACE VIDEA – tady měň texty, čísla, štítky a kamery.
 *  Součet durationInFrames = délka videa (30 fps → 450 = 15 s).
 * ============================================================ */

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  /** Malý nadpis nahoře po celou dobu videa */
  title: '☀️ JAK FUNGUJÍ SOLÁRNÍ PANELY',
};

export const SCENES: SceneConfig[] = [
  {
    id: 'slunce',
    durationInFrames: 113,
    camera: {
      from: {position: [3.5, 2.2, 22], target: [-0.5, 4.4, 0]},
      to: {position: [1.5, 2.6, 19], target: [-0.5, 4.4, 0]},
      fov: 45,
    },
    effects: {photons: true},
    captions: ['SLUNCE KAŽDÝ DEN', 'POSÍLÁ NA ZEM', 'OBROVSKOU *ENERGII*'],
    counter: {from: 0, to: 1000, suffix: ' W/m²', label: 'síla slunečního záření'},
    labels: [
      {emoji: '☀️', text: 'Slunce', target: [-2.2, 7.5, 1.5], offset: [330, 60], delay: 10},
      {emoji: '🏠', text: 'Panely na střeše', target: [0.6, 3.1, 0.9], offset: [230, -200], delay: 35},
    ],
  },
  {
    id: 'fotony',
    durationInFrames: 112,
    camera: {
      from: {position: [2.6, 5.4, 5.6], target: [0.2, 3.0, 0.9]},
      to: {position: [1.6, 4.9, 4.6], target: [0.0, 3.0, 0.9]},
      fov: 50,
    },
    effects: {photons: true, panelGlow: true},
    captions: ['*FOTONY* DOPADAJÍ', 'NA *KŘEMÍKOVÉ* ČLÁNKY', 'A UVOLNÍ *ELEKTRONY*'],
    counter: {from: 0, to: 60, suffix: ' článků', label: 'v jednom panelu'},
    labels: [
      {emoji: '✨', text: 'Foton', target: [-0.8, 3.9, 1.3], offset: [250, 130], delay: 12},
      {emoji: '🔲', text: 'Křemíkový článek', target: [0.65, 3.1, 1.2], offset: [-80, 175], delay: 35},
    ],
  },
  {
    id: 'proud',
    durationInFrames: 113,
    camera: {
      from: {position: [7.5, 3.6, 6.5], target: [1.6, 2.0, 0.6]},
      to: {position: [6.2, 3.0, 5.2], target: [1.8, 1.9, 0.6]},
      fov: 50,
    },
    effects: {panelGlow: true, dcCurrent: true},
    captions: ['ELEKTRONY TEČOU', 'KABELEM JAKO *PROUD*', '*STEJNOSMĚRNÝ* PROUD'],
    counter: {from: 0, to: 400, suffix: ' W', label: 'výkon jednoho panelu'},
    labels: [
      {emoji: '⚡', text: 'Elektrony', target: [2.15, 2.2, 1.15], offset: [-330, -250], delay: 10},
      {emoji: '🔌', text: 'Kabel', target: [2.15, 1.75, 0.95], offset: [260, 180], delay: 35},
    ],
  },
  {
    id: 'domov',
    durationInFrames: 112,
    camera: {
      from: {position: [6.5, 2.2, 8.5], target: [0.9, 1.6, 0.6]},
      to: {position: [4.5, 2.6, 10], target: [0.6, 2.0, 0.6]},
      fov: 50,
    },
    effects: {panelGlow: true, dcCurrent: true, acCurrent: true, lights: true},
    captions: ['*STŘÍDAČ* HO MĚNÍ', 'NA PROUD PRO *DŮM*', '*ČISTÁ ENERGIE* ZE SLUNCE'],
    counter: {from: 0, to: 230, suffix: ' V', label: 'napětí v zásuvce'},
    labels: [
      {emoji: '🔄', text: 'Střídač', target: [2.22, 1.2, 0.6], offset: [210, -280], delay: 8},
      {emoji: '💡', text: 'Spotřebiče', target: [0.8, 1.5, 1.55], offset: [-250, -330], delay: 30},
    ],
  },
];
