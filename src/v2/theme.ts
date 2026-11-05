import {loadFont as montserrat} from '@remotion/google-fonts/Montserrat';
import {loadFont as inter} from '@remotion/google-fonts/Inter';
import {loadFont as plexMono} from '@remotion/google-fonts/IBMPlexMono';
import type {Accent} from './schema';

// latin-ext = česká a rumunská diakritika
const subsets = ['latin', 'latin-ext'] as ('latin' | 'latin-ext')[];
export const HEAD_FONT = montserrat('normal', {weights: ['800', '900'], subsets}).fontFamily;
export const BODY_FONT = inter('normal', {weights: ['500', '700', '800'], subsets}).fontFamily;
export const MONO_FONT = plexMono('normal', {weights: ['500', '600'], subsets}).fontFamily;

export type Theme = {
  name: string;
  bg: string;
  grid: string;
  ink: string;
  muted: string;
  panel: string;
  panelBorder: string;
  line: string; // čáry diagramů
  accents: Record<Accent, string>;
  dark: boolean;
};

const THEMES: Theme[] = [
  {
    name: 'blueprint',
    bg: 'radial-gradient(ellipse at 50% 30%, #1a4e93 0%, #0f3770 45%, #0a2550 100%)',
    grid: 'rgba(170,205,255,0.07)',
    ink: '#EEF5FF',
    muted: '#9FB8DD',
    panel: 'rgba(255,255,255,0.045)',
    panelBorder: 'rgba(170,205,255,0.32)',
    line: '#DCE9FF',
    accents: {yellow: '#FFC83D', teal: '#5EEAD4', red: '#FF6B6B', blue: '#7CC4FF'},
    dark: true,
  },
  {
    name: 'noir',
    bg: 'radial-gradient(ellipse at 50% 35%, #1c1c22 0%, #0d0d10 60%, #070709 100%)',
    grid: 'rgba(255,255,255,0.045)',
    ink: '#F5F2EA',
    muted: '#8D8C93',
    panel: 'rgba(255,255,255,0.03)',
    panelBorder: 'rgba(255,255,255,0.16)',
    line: '#E9E6DE',
    accents: {yellow: '#FFD24A', teal: '#4FE3C1', red: '#FF4D2E', blue: '#6EA8FF'},
    dark: true,
  },
  {
    name: 'paper',
    bg: 'radial-gradient(ellipse at 50% 30%, #f6f2ea 0%, #ece6da 70%, #e2dbcd 100%)',
    grid: 'rgba(40,30,10,0.06)',
    ink: '#1B1A17',
    muted: '#6E685C',
    panel: 'rgba(255,255,255,0.45)',
    panelBorder: 'rgba(40,30,10,0.18)',
    line: '#2A2824',
    accents: {yellow: '#D99A00', teal: '#0E9F8A', red: '#E5482D', blue: '#2D6CDF'},
    dark: false,
  },
  {
    name: 'violet',
    bg: 'radial-gradient(ellipse at 50% 30%, #2a2547 0%, #17142a 55%, #0d0b18 100%)',
    grid: 'rgba(190,180,255,0.06)',
    ink: '#F1EFFF',
    muted: '#A7A1CC',
    panel: 'rgba(255,255,255,0.04)',
    panelBorder: 'rgba(190,180,255,0.28)',
    line: '#E4E0FF',
    accents: {yellow: '#FFC857', teal: '#5CE1E6', red: '#FF6B9A', blue: '#7DB4FF'},
    dark: true,
  },
];

export const themeFor = (id: number): Theme => THEMES[id % THEMES.length];

/** Hudba (smyčky v public/music) – střídá se podle čísla videa. */
export const MUSIC = ['music/loop-a.wav', 'music/loop-b.wav', 'music/loop-c.wav', 'music/loop-d.wav'];
