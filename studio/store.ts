import fs from 'node:fs';
import path from 'node:path';
import type {Lang} from '../src/engine/schema';

export const DATA = path.join(process.cwd(), 'data');
const FILE = path.join(DATA, 'studio.json');

export type Platform = 'tiktok' | 'instagram' | 'youtube';
export type Channel = {
  id: string;
  name: string;
  platform: Platform;
  lang: Lang;
  enabled: boolean;
};
export type Post = {
  channelId: string;
  videoId: number;
  at: string;
  status: 'ok' | 'error' | 'manual';
  message?: string;
};
export type Store = {
  channels: Channel[];
  schedule: {enabled: boolean; times: string[]};
  /** videa vyřazená z automatického publikování (true = vynechat) */
  skip: Record<string, boolean>;
  posts: Post[];
  /** poslední obsloužený časový slot pro každý kanál: "2026-11-05 11:00" */
  lastSlot: Record<string, string>;
};

const DEFAULT: Store = {
  channels: [
    {id: 'tiktok', name: 'TikTok', platform: 'tiktok', lang: 'cs', enabled: true},
    {id: 'instagram', name: 'Instagram', platform: 'instagram', lang: 'cs', enabled: true},
    {id: 'youtube', name: 'YouTube', platform: 'youtube', lang: 'cs', enabled: true},
  ],
  schedule: {enabled: false, times: ['11:30', '18:30']},
  // videa 1–14 už máš použitá → ve výchozím stavu se automaticky nepublikují
  skip: Object.fromEntries(Array.from({length: 14}, (_, i) => [String(i + 1), true])),
  posts: [],
  lastSlot: {},
};

export const load = (): Store => {
  try {
    return {...DEFAULT, ...JSON.parse(fs.readFileSync(FILE, 'utf8'))};
  } catch {
    return structuredClone(DEFAULT);
  }
};

export const save = (s: Store) => {
  fs.mkdirSync(DATA, {recursive: true});
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  fs.renameSync(tmp, FILE);
};

export const update = (fn: (s: Store) => void) => {
  const s = load();
  fn(s);
  save(s);
  return s;
};
