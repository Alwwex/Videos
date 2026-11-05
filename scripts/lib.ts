import fs from 'node:fs';
import path from 'node:path';
import {LANGS, VideoScriptSchema, type Lang, type Timeline, type VideoScript} from '../src/engine/schema';

export const ROOT = process.cwd();
export const P = {
  ideas: path.join(ROOT, 'napady', 'napady.json'),
  scripts: path.join(ROOT, 'content', 'scripts'),
  timelines: path.join(ROOT, 'content', 'timelines'),
  audio: path.join(ROOT, 'public', 'generated'),
  videos: path.join(ROOT, 'out', 'videos'),
};

if (fs.existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

export type Idea = {id: number; kategorie: string; tema: string};
export const loadIdeas = (): Idea[] => JSON.parse(fs.readFileSync(P.ideas, 'utf8')).napady;

export const pad = (id: number) => String(id).padStart(3, '0');
export const scriptPath = (id: number) => path.join(P.scripts, `${pad(id)}.json`);
export const timelinePath = (id: number, lang: Lang) => path.join(P.timelines, `${pad(id)}.${lang}.json`);

export const loadScript = (id: number): VideoScript | null => {
  const f = scriptPath(id);
  if (!fs.existsSync(f)) return null;
  return VideoScriptSchema.parse(JSON.parse(fs.readFileSync(f, 'utf8')));
};
export const loadTimeline = (id: number, lang: Lang): Timeline | null => {
  const f = timelinePath(id, lang);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};

export const writeJson = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

/** Argumenty: "1-10,15 --langs cs,en --force --concurrency 3" */
export const parseArgs = (argv = process.argv.slice(2)) => {
  const ids = new Set<number>();
  let langs: Lang[] = [...LANGS];
  let force = false;
  let concurrency = 0;
  let noMusic = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') force = true;
    else if (a === '--no-music') noMusic = true;
    else if (a === '--langs') langs = argv[++i].split(',').filter((l): l is Lang => (LANGS as readonly string[]).includes(l));
    else if (a === '--concurrency') concurrency = Number(argv[++i]);
    else if (a === 'all') loadIdeas().forEach((x) => ids.add(x.id));
    else
      for (const part of a.split(',')) {
        const [from, to] = part.split('-').map(Number);
        if (Number.isNaN(from)) continue;
        for (let n = from; n <= (to || from); n++) ids.add(n);
      }
  }
  if (ids.size === 0) {
    console.error('Zadej čísla nápadů, např.:  npm run generate -- 1-10   (nebo "all")');
    process.exit(1);
  }
  return {ids: [...ids].sort((x, y) => x - y), langs, force, concurrency, noMusic};
};

/** Pustí úlohy s omezeným počtem souběžných. */
export const pool = async <T,>(items: T[], n: number, fn: (x: T) => Promise<void>) => {
  const queue = [...items];
  await Promise.all(
    Array.from({length: Math.max(1, n)}, async () => {
      while (queue.length) await fn(queue.shift() as T);
    }),
  );
};

/** Ukazatel postupu dávky: kreslí lištu do terminálu a zapisuje stav do out/STAV.txt. */
export class Progress {
  private t0 = Date.now();
  private done = 0;
  private failed = 0;
  private current = '';
  private pct = 0;
  private log: string[] = [];
  private lastWrite = 0;
  constructor(
    private label: string,
    private total: number,
    private file = path.join(ROOT, 'out', 'STAV.txt'),
  ) {
    this.draw(true);
  }
  /** Průběh aktuální položky (0–1). */
  update(current: string, pct: number) {
    this.current = current;
    this.pct = pct;
    this.draw();
  }
  ok(msg: string) {
    this.done++;
    this.pct = 0;
    this.log.push(`✅ ${msg}`);
    this.draw(true);
  }
  fail(msg: string) {
    this.failed++;
    this.pct = 0;
    this.log.push(`❌ ${msg}`);
    this.draw(true);
  }
  skip() {
    this.total = Math.max(0, this.total - 1);
    this.draw(true);
  }
  /** Ukončeno uživatelem – zbytek fronty se nerenderuje. */
  stopped() {
    this.log.push('⏹️ Zastaveno uživatelem');
    this.total = this.done + this.failed;
    this.current = '';
    this.pct = 0;
    this.draw(true);
  }
  private draw(force = false) {
    const finished = this.done + this.failed;
    const overall = this.total ? Math.min(1, (finished + this.pct) / this.total) : 1;
    const W = 30;
    const filled = Math.round(overall * W);
    const bar = '█'.repeat(filled) + '░'.repeat(W - filled);
    const elapsed = (Date.now() - this.t0) / 60000;
    const eta = overall > 0.02 ? (elapsed / overall) * (1 - overall) : NaN;
    const etaTxt = Number.isFinite(eta) ? `zbývá ~${eta < 1 ? '<1' : Math.round(eta)} min` : 'odhaduji čas…';
    const now = this.current && finished < this.total ? ` | teď ${this.current} ${Math.round(this.pct * 100)} %` : '';
    const line = `${this.label} [${bar}] ${Math.round(overall * 100)} % | ${finished}/${this.total}${now} | ${etaTxt}`;
    process.stdout.write(`\r${line}`.padEnd(150) + (force && finished === this.total ? '\n' : ''));
    if (force || Date.now() - this.lastWrite > 2000) {
      this.lastWrite = Date.now();
      const body = [
        `${this.label} – aktualizováno ${new Date().toLocaleTimeString('cs-CZ')}`,
        '',
        `[${bar}] ${Math.round(overall * 100)} %`,
        `Hotovo: ${this.done}   Selhalo: ${this.failed}   Celkem: ${this.total}`,
        now ? `Právě: ${this.current} (${Math.round(this.pct * 100)} %)` : finished === this.total ? '🏁 DOKONČENO' : '',
        `Uplynulo: ${elapsed.toFixed(1)} min   ${etaTxt}`,
        '',
        ...this.log.slice().reverse(),
      ].join('\n');
      try {
        fs.mkdirSync(path.dirname(this.file), {recursive: true});
        fs.writeFileSync(this.file, body);
        // strojově čitelná verze pro panel (npm run panel)
        fs.writeFileSync(
          path.join(path.dirname(this.file), 'stav.json'),
          JSON.stringify({
            label: this.label,
            overall,
            done: this.done,
            failed: this.failed,
            total: this.total,
            current: finished < this.total ? this.current : '',
            pct: this.pct,
            elapsedMin: elapsed,
            etaMin: Number.isFinite(eta) ? eta : null,
            finished: finished === this.total,
            log: this.log.slice().reverse(),
            updatedAt: Date.now(),
          }),
        );
      } catch {
        /* soubor může být chvilku zamčený editorem */
      }
    }
  }
}
