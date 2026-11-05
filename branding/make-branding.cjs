// Generátor profilovek a bannerů (potřebuje balíček "playwright"): node branding/make-branding.cjs branding
const {chromium} = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];
const head = `<link href="https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Caveat:wght@700&display=block" rel="stylesheet"><style>body{margin:0}</style>`;
const INK = '#1d2557';
const C = {red: '#ff4d5e', orange: '#ff9a2e', yellow: '#ffd23f', green: '#2fcf7a', teal: '#1fc2d6', blue: '#3d7bff', purple: '#9b5cff', pink: '#ff5fb0'};
const defs = `<defs>
  <filter id="r"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter>
  <filter id="r2"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="9"/><feDisplacementMap in="SourceGraphic" scale="10"/></filter>
  <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .25  0 0 0 0 .15  0 0 0 .08 0"/></filter></defs>`;
const pen = (d, w = 9, c = INK) => `<g filter="url(#r)"><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const fill = (d, c, dx = -8, dy = 7) => `<g filter="url(#r2)" style="mix-blend-mode:multiply"><path d="${d}" fill="${c}" opacity=".9" transform="translate(${dx} ${dy})"/></g>`;
const at = (x, y, s, rot, inner) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${inner}</g>`;
// čmáranice (kreslené kolem 0,0, velikost ~100)
const D = {
  apple: () => { const b = 'M0-30c30-18 62-4 64 34 2 40-26 74-64 74S-66 44-64 4c2-38 34-52 64-34z'; return fill(b, C.red) + pen(b) + pen('M0-30c0-16 4-28 14-38') + fill('M14-56c12-14 36-14 46-4-12 14-34 16-46 4z', C.green, -3, 3) + pen('M14-56c12-14 36-14 46-4-12 14-34 16-46 4z', 7); },
  bulb: () => { const b = 'M0-70c48 0 76 32 76 70 0 32-20 46-32 66v18h-88v-18c-12-20-32-34-32-66 0-38 28-70 76-70z'; return fill(b, C.yellow) + pen(b) + pen('M-40 96h80M-32 116h64') + pen('M-96-60l-22-14M96-60l22-14M0-96v-24', 8); },
  magnet: () => { const b = 'M-56-50v50a56 56 0 0 0 112 0v-50h-32v50a24 24 0 0 1-48 0v-50z'; return fill('M-56-50h32v22h-32z', C.red, -4, 4) + fill('M24-50h32v22h-32z', C.blue, -4, 4) + pen(b) + pen('M-56-28h32M24-28h32', 7); },
  atom: () => pen('M0 0m-70 0a70 26 0 1 0 140 0a70 26 0 1 0-140 0', 7, C.purple) + `<g transform="rotate(60)">${pen('M-70 0a70 26 0 1 0 140 0a70 26 0 1 0-140 0', 7, C.purple)}</g><g transform="rotate(-60)">${pen('M-70 0a70 26 0 1 0 140 0a70 26 0 1 0-140 0', 7, C.purple)}</g>` + `<circle r="13" fill="${C.pink}" filter="url(#r)"/>`,
  planet: () => fill('M0 0m-46 0a46 46 0 1 0 92 0a46 46 0 1 0-92 0', C.orange) + pen('M0 0m-46 0a46 46 0 1 0 92 0a46 46 0 1 0-92 0') + pen('M-88 14c-10 22 80 10 130-18 40-22 60-44 40-48', 8, C.purple),
  rocket: () => { const b = 'M0-80c30 26 40 66 30 110h-60c-10-44 0-84 30-110z'; return fill(b, C.blue) + pen(b) + `<circle cy="-16" r="13" fill="#fff" stroke="${INK}" stroke-width="7" filter="url(#r)"/>` + pen('M-30 30l-22 26 26-4M30 30l22 26-26-4') + fill('M-14 40c-6 22 10 32 14 50 4-18 20-28 14-50z', C.orange, 0, 0); },
  bolt: () => { const b = 'M14-70L-34 6h30l-12 64 50-80h-30z'; return fill(b, C.yellow) + pen(b); },
  wave: () => pen('M-90 0c15-40 30-40 45 0s30 40 45 0 30-40 45 0 30 40 45 0', 9, C.teal),
  star: () => { const b = 'M0-40l11 26 29 3-22 19 7 28-25-15-25 15 7-28-22-19 29-3z'; return fill(b, C.yellow, -4, 4) + pen(b, 6); },
  spark: (c) => pen('M0-26v52M-26 0h52M-17-17l34 34M17-17l-34 34', 6, c),
};
const T = {cs: ['fyzika', 'kolem tebe'], en: ['physics', 'around you'], ro: ['fizica', 'din jurul tău']};
const scene = (lang, w = 1080, h = 1080, banner = false) => {
  const [a, b] = T[lang];
  const cx = w / 2, cy = h / 2;
  // rozmístění čmáranic: u profilovky v prstenci kolem nápisu, u banneru do stran
  const items = banner
    ? [['apple', -840, -230, 1.5, -10], ['bulb', 860, -250, 1.4, 12], ['magnet', -1040, 150, 1.2, 18], ['atom', 1050, 170, 1.5, 0], ['planet', -600, 300, 1.2, 0], ['rocket', 640, 290, 1.2, 25], ['bolt', -1120, -380, 1, 10], ['wave', 1080, -420, 1, -8], ['star', -400, -390, .9, 10], ['star', 420, 400, .8, -12], ['spark', -1180, 400, 1, 0, C.pink], ['spark', 1190, -40, 1, 0, C.green]]
    : [['apple', -220, -300, 1.0, -12], ['bulb', 220, -280, .85, 12], ['magnet', -390, -120, .75, -18], ['atom', 390, -110, .85, 0], ['bolt', 0, -380, .8, 8], ['planet', -270, 290, 1.0, 0], ['rocket', 270, 290, .95, 25], ['wave', 0, 390, .8, -4], ['spark', -420, 120, .6, 0, C.pink], ['star', 420, 130, .6, 10]];
  const doodles = items.map(([k, x, y, s, r, c]) => at(cx + x, cy + y, s, r, D[k](c))).join('');
  const big = banner ? 300 : Math.min(175, Math.floor(1050 / a.length));
  const small = banner ? 120 : 92;
  const hlW = banner ? 1150 : 680;
  return `<div style="width:${w}px;height:${h}px;position:relative;background:#f6f0e2;overflow:hidden">
    <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(70,110,170,.15) 2px,transparent 2px),linear-gradient(90deg,rgba(70,110,170,.15) 2px,transparent 2px);background-size:66px 66px"></div>
    <svg width="${w}" height="${h}" style="position:absolute;inset:0">${defs}<rect width="${w}" height="${h}" filter="url(#n)"/>
      ${doodles}
      <!-- duhový zvýrazňovač pod nápisem -->
      <defs><linearGradient id="hl" x1="0" x2="1"><stop offset="0" stop-color="${C.pink}"/><stop offset=".35" stop-color="${C.orange}"/><stop offset=".7" stop-color="${C.yellow}"/><stop offset="1" stop-color="${C.green}"/></linearGradient></defs>
      <g filter="url(#r2)" style="mix-blend-mode:multiply"><path d="M${cx - hlW / 2} ${cy + big * 0.12}c${hlW * 0.3}-24 ${hlW * 0.7}-28 ${hlW} -8l-6 ${big * 0.32}c-${hlW * 0.3}-14-${hlW * 0.7}-10-${hlW - 6} 12z" fill="url(#hl)" opacity=".85"/></g>
      <g filter="url(#r)"><text x="${cx}" y="${cy + big * 0.28}" text-anchor="middle" font-family="Permanent Marker" font-size="${big}" fill="${INK}" transform="rotate(-5 ${cx} ${cy})">${a}</text></g>
      <text x="${cx}" y="${cy + big * 0.28 + small * 1.05}" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="${small}" fill="${C.red}" transform="rotate(-4 ${cx} ${cy})">${b}</text>
    </svg></div>`;
};
(async () => {
  const br = await chromium.launch();
  const shot = async (html, w, h, file) => {
    const p = await br.newPage({viewport: {width: w, height: h}});
    await p.setContent(`<!doctype html><html><head>${head}</head><body>${html}</body></html>`, {waitUntil: 'networkidle'});
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({path: `${OUT}/${file}`});
    await p.close();
  };
  for (const l of ['cs', 'en', 'ro']) {
    await shot(scene(l), 1080, 1080, `profilovka-${l}.png`);
    await shot(scene(l, 2560, 1440, true), 2560, 1440, `youtube-banner-${l}.png`);
  }
  const p = await br.newPage({viewport: {width: 1400, height: 520}});
  const cards = ['cs', 'en', 'ro'].map((l) => `<img src="data:image/png;base64,${fs.readFileSync(`${OUT}/profilovka-${l}.png`).toString('base64')}" style="width:360px;height:360px;border-radius:50%;box-shadow:0 10px 40px rgba(0,0,0,.5)">`).join('');
  await p.setContent(`<body style="margin:0;background:#14161c;display:flex;justify-content:space-around;align-items:center;height:520px">${cards}</body>`);
  await p.screenshot({path: `${OUT}/nahled-profilovek.png`});
  await br.close();
})();
