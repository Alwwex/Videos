import {FONTS, type FontKey} from '../fonts';

/* Vizuální variace mezi videi. Každá složka se vybírá z čísla videa jiným
 * "krokem", takže vzniká hodně kombinací a sousední videa vypadají jinak. */

export type HookStyle = 'slam' | 'drop' | 'zoom' | 'type';
export type Transition = 'flash' | 'zoom' | 'wipe' | 'tilt';

type Palette = {
  name: string;
  accent: string; // zvýrazněná slova, počítadlo
  bar: [string, string]; // ukazatel průběhu
  walls: string[];
  skies: string[]; // venkovní obloha
  floor: string;
  light: string; // barva slunce / lampy
  grass: string;
  flash: string;
};

const PALETTES: Palette[] = [
  {
    name: 'slunce',
    accent: '#FFD43B',
    bar: ['#FFD43B', '#FF9F1C'],
    walls: ['#f6d9a8', '#cfe8e4', '#f8c9b5', '#cfdcf6'],
    skies: ['linear-gradient(180deg, #ff9f5a 0%, #ffd29a 45%, #ffe9c4 100%)', 'linear-gradient(180deg, #6fc3ff 0%, #bfe6ff 50%, #fff1d6 100%)'],
    floor: '#d9a066',
    light: '#ffd29a',
    grass: '#86c95e',
    flash: '#fff6e6',
  },
  {
    name: 'mentol',
    accent: '#3DF2C2',
    bar: ['#3DF2C2', '#2BB8FF'],
    walls: ['#9fe3d3', '#b5e4f7', '#c8ecb0', '#a8d4ee'],
    skies: ['linear-gradient(180deg, #48c6ef 0%, #aee9f7 50%, #e9fff6 100%)', 'linear-gradient(180deg, #5ee7df 0%, #b8f3e9 55%, #f3fff9 100%)'],
    floor: '#8fb9b0',
    light: '#e8fff6',
    grass: '#6fd18a',
    flash: '#eafff8',
  },
  {
    name: 'korál',
    accent: '#FF6B8B',
    bar: ['#FF6B8B', '#FFB86B'],
    walls: ['#ffb3a7', '#ffd09a', '#f5b0cf', '#ffc9b0'],
    skies: ['linear-gradient(180deg, #ff7e95 0%, #ffc3a0 50%, #fff0e1 100%)', 'linear-gradient(180deg, #f9748f 0%, #fe9a8b 45%, #ffe6cf 100%)'],
    floor: '#e7a88f',
    light: '#ffd6c8',
    grass: '#92cf63',
    flash: '#fff0f2',
  },
  {
    name: 'fialka',
    accent: '#C59BFF',
    bar: ['#C59BFF', '#6BCBFF'],
    walls: ['#cbb2f0', '#b8c4f5', '#e8b9e2', '#c4b0ee'],
    skies: ['linear-gradient(180deg, #8e7cff 0%, #c7b8ff 50%, #f5efff 100%)', 'linear-gradient(180deg, #a18cd1 0%, #fbc2eb 100%)'],
    floor: '#a993c9',
    light: '#efe2ff',
    grass: '#7cc96a',
    flash: '#f6f0ff',
  },
  {
    name: 'limetka',
    accent: '#C6F432',
    bar: ['#C6F432', '#3DD68C'],
    walls: ['#dff0a0', '#b9ecc4', '#f4ea96', '#c8e8b0'],
    skies: ['linear-gradient(180deg, #7fd36b 0%, #d4f5a5 50%, #fbffe8 100%)', 'linear-gradient(180deg, #56ccf2 0%, #c4f1b8 60%, #fbffe8 100%)'],
    floor: '#b9c97a',
    light: '#f6ffd8',
    grass: '#7ed957',
    flash: '#fbffe9',
  },
  {
    name: 'oceán',
    accent: '#4FD8FF',
    bar: ['#4FD8FF', '#7B7BFF'],
    walls: ['#a9cff0', '#a6e6e8', '#bfcaf2', '#9fd0e6'],
    skies: ['linear-gradient(180deg, #2b6cff 0%, #8fc2ff 50%, #e8f3ff 100%)', 'linear-gradient(180deg, #1fa2ff 0%, #a6ffcb 100%)'],
    floor: '#86a9c4',
    light: '#e2f1ff',
    grass: '#6cc78a',
    flash: '#eef7ff',
  },
];

const FONT_KEYS: FontKey[] = ['montserrat', 'poppins', 'rubik', 'nunito'];
const HOOKS: HookStyle[] = ['slam', 'drop', 'zoom', 'type'];
const TRANSITIONS: Transition[] = ['flash', 'zoom', 'wipe', 'tilt'];
const MUSIC = ['music/loop-a.wav', 'music/loop-b.wav', 'music/loop-c.wav', 'music/loop-d.wav'];

export type Theme = Palette & {font: string; fontKey: FontKey; hook: HookStyle; transition: Transition; music: string; captionBottom: number};

export const themeFor = (id: number): Theme => {
  const p = PALETTES[id % PALETTES.length];
  const fontKey = FONT_KEYS[(id * 3 + 1) % FONT_KEYS.length];
  return {
    ...p,
    fontKey,
    font: FONTS[fontKey],
    hook: HOOKS[(id * 5 + 2) % HOOKS.length],
    transition: TRANSITIONS[(id * 7 + 3) % TRANSITIONS.length],
    music: MUSIC[(id * 3) % MUSIC.length],
    captionBottom: [360, 400, 330][id % 3],
  };
};
