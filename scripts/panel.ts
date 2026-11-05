/**
 * Ovládací panel v prohlížeči: průběh renderu + přehrávač hotových videí.
 *   npm run panel   → http://localhost:4321
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const PORT = Number(process.env.PANEL_PORT || 4321);
const OUT = path.join(process.cwd(), 'out');
const VIDEOS = path.join(OUT, 'videos');

const listVideos = () => {
  const res: {lang: string; file: string; title: string; size: number; mtime: number}[] = [];
  for (const lang of ['cs', 'en', 'ro']) {
    const dir = path.join(VIDEOS, lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.mp4')) continue;
      const st = fs.statSync(path.join(dir, f));
      const txt = path.join(dir, f.replace(/\.mp4$/, '.txt'));
      const title = fs.existsSync(txt) ? fs.readFileSync(txt, 'utf8').split('\n')[0] : f;
      res.push({lang, file: f, title, size: st.size, mtime: st.mtimeMs});
    }
  }
  return res.sort((a, b) => a.file.localeCompare(b.file) || a.lang.localeCompare(b.lang));
};

/**
 * Video posíláme po kouscích (max 2 MB) a soubor hned zavřeme. Na Windows totiž
 * otevřený soubor nejde přepsat – kdyby ho panel držel, render by selhal.
 */
const CHUNK = 2 * 1024 * 1024;
const sendVideo = (req: http.IncomingMessage, res: http.ServerResponse, file: string) => {
  const size = fs.statSync(file).size;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  const start = range ? Number(range[1] || 0) : 0;
  const end = Math.min(size - 1, range?.[2] ? Number(range[2]) : start + CHUNK - 1);
  const len = Math.max(0, end - start + 1);
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buf, 0, len, start);
  } finally {
    fs.closeSync(fd);
  }
  res.writeHead(206, {
    'Content-Type': 'video/mp4',
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': len,
    'Cache-Control': 'no-store',
  });
  res.end(buf);
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  try {
    if (url === '/') {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      return res.end(HTML);
    }
    if (url === '/api/stav') {
      const f = path.join(OUT, 'stav.json');
      res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
      return res.end(fs.existsSync(f) ? fs.readFileSync(f) : 'null');
    }
    if (url === '/api/stop' && req.method === 'POST') {
      fs.mkdirSync(OUT, {recursive: true});
      fs.writeFileSync(path.join(OUT, 'STOP'), String(Date.now()));
      res.writeHead(200, {'Content-Type': 'application/json'});
      return res.end('{"ok":true}');
    }
    if (url === '/api/videa') {
      res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
      return res.end(JSON.stringify(listVideos()));
    }
    const m = url.match(/^\/video\/(cs|en|ro)\/([\w.-]+\.mp4)$/);
    if (m) {
      const file = path.join(VIDEOS, m[1], m[2]);
      if (fs.existsSync(file)) return sendVideo(req, res, file);
    }
    const t = url.match(/^\/popis\/(cs|en|ro)\/([\w.-]+)\.txt$/);
    if (t) {
      const file = path.join(VIDEOS, t[1], `${t[2]}.txt`);
      if (fs.existsSync(file)) {
        res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
        return res.end(fs.readFileSync(file));
      }
    }
    res.writeHead(404);
    res.end('Nenalezeno');
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`📺 Panel běží: http://localhost:${PORT}  (ukončíš Ctrl+C)`));

const HTML = /* html */ `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fyzika – render</title>
<style>
  :root { --bg:#14110d; --card:#1f1a14; --line:#3a3127; --text:#f6efe4; --muted:#b3a593; --accent:#ffd43b; --ok:#3dd68c; --bad:#ff6b6b; }
  * { box-sizing:border-box; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background:var(--bg); color:var(--text); }
  main { max-width:1100px; margin:0 auto; padding:24px 16px 60px; }
  h1 { font-size:22px; margin:0 0 18px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:20px; margin-bottom:18px; }
  .bar { height:22px; background:#2b241c; border-radius:999px; overflow:hidden; }
  .fill { height:100%; width:0; background:linear-gradient(90deg,#ffd43b,#ff9f1c); transition:width .6s ease; }
  .fill.cur { background:linear-gradient(90deg,#4fd8ff,#7b7bff); }
  .big { font-size:44px; font-weight:800; font-variant-numeric:tabular-nums; }
  .row { display:flex; gap:24px; flex-wrap:wrap; align-items:baseline; margin:10px 0 14px; }
  .stat b { font-size:20px; font-variant-numeric:tabular-nums; } .stat span { color:var(--muted); font-size:13px; display:block; }
  .muted { color:var(--muted); font-size:14px; }
  .log { max-height:220px; overflow:auto; font-size:13px; line-height:1.7; color:var(--muted); margin-top:12px; }
  .done { color:var(--ok); font-weight:700; }
  .tabs { display:flex; gap:8px; margin-bottom:14px; }
  .tabs button { background:#2b241c; color:var(--text); border:1px solid var(--line); border-radius:999px; padding:8px 16px; cursor:pointer; font-size:14px; }
  .tabs button.on { background:var(--accent); color:#1a1307; border-color:var(--accent); font-weight:700; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:14px; }
  .vid { background:#2b241c; border-radius:12px; overflow:hidden; cursor:pointer; border:1px solid var(--line); }
  .vid video { width:100%; aspect-ratio:9/16; object-fit:cover; display:block; background:#000; }
  .vid p { margin:8px 10px 10px; font-size:13px; line-height:1.3; }
  .vid small { color:var(--muted); }
  dialog { background:var(--card); color:var(--text); border:1px solid var(--line); border-radius:16px; padding:16px; max-width:min(96vw,460px); }
  dialog video { width:100%; max-height:75vh; border-radius:10px; background:#000; }
  dialog pre { white-space:pre-wrap; font-size:13px; color:var(--muted); }
  dialog button { margin-top:8px; }
  .stop { margin-top:14px; background:#3a1f1f; color:#ffb3b3; border:1px solid #6b3434; border-radius:999px; padding:8px 18px; cursor:pointer; font-size:14px; }
  .stop:hover { background:#4a2626; }
</style>
</head>
<body>
<main>
  <h1>🎬 Fyzika kolem tebe – stav renderu</h1>
  <section class="card" id="stav"><span class="muted">Načítám…</span></section>
  <section class="card">
    <div class="tabs" id="tabs"></div>
    <div class="grid" id="videa"></div>
  </section>
</main>
<dialog id="dlg"><video id="player" controls playsinline></video><pre id="popis"></pre><button onclick="dlg.close()">Zavřít</button></dialog>
<script>
const $ = (id) => document.getElementById(id);
let lang = localStorage.getItem('lang') || 'cs';
let known = '';
const fmtMin = (m) => m == null ? '–' : m < 1 ? '< 1 min' : Math.round(m) + ' min';

async function stav() {
  try {
    const s = await (await fetch('/api/stav')).json();
    if (!s) { $('stav').innerHTML = '<span class="muted">Zatím neběží žádný render. Spusť <code>npm run render:batch -- 1-14</code>.</span>'; return; }
    const stale = Date.now() - s.updatedAt > 5 * 60 * 1000 && !s.finished;
    $('stav').innerHTML = \`
      <div class="row">
        <div class="big">\${Math.round(s.overall * 100)} %</div>
        <div class="stat"><b>\${s.done}/\${s.total}</b><span>hotových videí</span></div>
        <div class="stat"><b>\${s.failed}</b><span>selhalo</span></div>
        <div class="stat"><b>\${fmtMin(s.elapsedMin)}</b><span>uplynulo</span></div>
        <div class="stat"><b>\${s.finished ? '🏁' : fmtMin(s.etaMin)}</b><span>\${s.finished ? 'dokončeno' : 'zbývá'}</span></div>
      </div>
      <div class="bar"><div class="fill" style="width:\${s.overall * 100}%"></div></div>
      \${!s.finished && !stale ? '<button class="stop" onclick="stopRender()">⏹ Zastavit render</button>' : ''}
      \${s.current ? \`<p class="muted" style="margin:14px 0 6px">Právě: <b style="color:var(--text)">\${s.current}</b> – \${Math.round(s.pct * 100)} %</p>
        <div class="bar" style="height:10px"><div class="fill cur" style="width:\${s.pct * 100}%"></div></div>\` : ''}
      \${s.finished ? '<p class="done">🏁 Dávka je dokončená.</p>' : ''}
      \${stale ? '<p style="color:var(--bad)">⚠️ Stav se přes 5 minut neaktualizoval – render asi neběží.</p>' : ''}
      <div class="log">\${s.log.map((l) => '<div>' + l + '</div>').join('')}</div>\`;
  } catch { $('stav').innerHTML = '<span style="color:var(--bad)">Panel ztratil spojení se serverem.</span>'; }
}

async function videa() {
  const list = await (await fetch('/api/videa')).json();
  const key = JSON.stringify(list.map((v) => v.lang + v.file + v.mtime)) + lang;
  if (key === known) return;
  known = key;
  const counts = { cs: 0, en: 0, ro: 0 };
  list.forEach((v) => counts[v.lang]++);
  $('tabs').innerHTML = ['cs', 'en', 'ro'].map((l) => \`<button class="\${l === lang ? 'on' : ''}" onclick="setLang('\${l}')">\${{cs:'🇨🇿 Česky',en:'🇬🇧 Anglicky',ro:'🇷🇴 Rumunsky'}[l]} (\${counts[l]})</button>\`).join('');
  const mine = list.filter((v) => v.lang === lang);
  $('videa').innerHTML = mine.length ? mine.map((v) => \`
    <div class="vid" onclick="play('\${v.lang}','\${v.file}')">
      <video src="/video/\${v.lang}/\${v.file}#t=2" preload="metadata" muted></video>
      <p>\${v.title}<br><small>\${v.file.slice(0, 3)} · \${(v.size / 1e6).toFixed(0)} MB · \${new Date(v.mtime).toLocaleTimeString('cs-CZ', {hour:'2-digit', minute:'2-digit'})}</small></p>
    </div>\`).join('') : '<p class="muted">V tomhle jazyce zatím nic není.</p>';
}
async function stopRender() {
  if (!confirm('Opravdu zastavit render? Hotová videa zůstanou.')) return;
  await fetch('/api/stop', { method: 'POST' });
}
function setLang(l) { lang = l; try { localStorage.setItem('lang', l); } catch {} known = ''; videa(); }
async function play(l, f) {
  $('player').src = '/video/' + l + '/' + f;
  $('popis').textContent = await (await fetch('/popis/' + l + '/' + f.replace(/\\.mp4$/, '.txt'))).text().catch(() => '');
  $('dlg').showModal(); $('player').play();
}
$('dlg').addEventListener('close', () => $('player').pause());
stav(); videa();
setInterval(stav, 1500); setInterval(videa, 5000);
</script>
</body>
</html>`;
