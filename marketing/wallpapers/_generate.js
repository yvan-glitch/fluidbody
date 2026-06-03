// Générateur de wallpapers FluidBody+ — Puppeteer-core sur Chrome installé.
// Esthétique écran de veille : dégradé navy→teal, méduses translucides, halos turquoise.
const puppeteer = require('/opt/homebrew/lib/node_modules/lighthouse/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = __dirname;

// ---- SVG méduse FluidBody+ (repris de fluidbody-web/assets/meduse.svg) ----
const MEDUSE = fs.readFileSync('/Users/xvan06/fluidbody-web/assets/meduse.svg', 'utf8')
  // on retire width/height fixes pour qu'elle remplisse son conteneur
  .replace(/\swidth="280"/, '').replace(/\sheight="520"/, '');

// ---- Résolutions ----
// orient: 'l' landscape (large), 'p' portrait (haut)
const RESOS = [
  // Mac
  { name: 'mac-5k-5120x2880',          w: 5120, h: 2880, o: 'l' },
  { name: 'mac-4k-3840x2160',          w: 3840, h: 2160, o: 'l' },
  { name: 'macbook-pro-14-3024x1964',  w: 3024, h: 1964, o: 'l' },
  { name: 'macbook-pro-16-3456x2234',  w: 3456, h: 2234, o: 'l' },
  // iPad
  { name: 'ipad-pro-12-9-2732x2048',   w: 2732, h: 2048, o: 'l' },
  { name: 'ipad-pro-12-9-2048x2732',   w: 2048, h: 2732, o: 'p' },
  { name: 'ipad-pro-11-2388x1668',     w: 2388, h: 1668, o: 'l' },
  { name: 'ipad-pro-11-1668x2388',     w: 1668, h: 2388, o: 'p' },
  // iPhone
  { name: 'iphone-15-pro-max-1290x2796', w: 1290, h: 2796, o: 'p' },
  { name: 'iphone-15-pro-1179x2556',     w: 1179, h: 2556, o: 'p' },
  { name: 'iphone-15-1170x2532',         w: 1170, h: 2532, o: 'p' },
  // Apple TV
  { name: 'apple-tv-3840x2160',        w: 3840, h: 2160, o: 'l' },
];

// ---- Layouts de méduses (positions % + taille en % de la hauteur du canvas) ----
// hf = hauteur méduse en fraction de la hauteur canvas. left/top = centre en %.
const LAYOUT = {
  l: [ // paysage : étalées horizontalement, profondeurs variées
    { left: 18, top: 38, hf: 0.62, op: 0.85, rot: -6, blur: 0 },
    { left: 50, top: 58, hf: 0.80, op: 1.00, rot: 3,  blur: 0 },
    { left: 80, top: 33, hf: 0.50, op: 0.70, rot: 8,  blur: 1.2 },
    { left: 66, top: 78, hf: 0.40, op: 0.55, rot: -4, blur: 2.5 },
    { left: 33, top: 82, hf: 0.34, op: 0.45, rot: 10, blur: 3.5 },
  ],
  p: [ // portrait : empilées verticalement, méduse principale au centre
    { left: 50, top: 30, hf: 0.42, op: 1.00, rot: 2,  blur: 0 },
    { left: 24, top: 52, hf: 0.30, op: 0.70, rot: -7, blur: 1.5 },
    { left: 76, top: 60, hf: 0.34, op: 0.78, rot: 6,  blur: 0.8 },
    { left: 56, top: 80, hf: 0.26, op: 0.50, rot: -3, blur: 3 },
    { left: 30, top: 84, hf: 0.20, op: 0.40, rot: 9,  blur: 4 },
  ],
};

function buildHTML(r, branded) {
  const A = 280 / 520; // ratio largeur/hauteur méduse
  const jellies = LAYOUT[r.o].map((j) => {
    const hpx = j.hf * r.h;
    const wpx = hpx * A;
    return `<div class="jelly" style="
      left:${(j.left/100*r.w - wpx/2).toFixed(1)}px;
      top:${(j.top/100*r.h - hpx/2).toFixed(1)}px;
      width:${wpx.toFixed(1)}px; height:${hpx.toFixed(1)}px;
      opacity:${j.op}; transform:rotate(${j.rot}deg);
      filter:${j.blur ? `blur(${(j.blur*r.h/1000).toFixed(1)}px)` : 'none'};
    ">${MEDUSE}</div>`;
  }).join('\n');

  // Halos turquoise — tailles relatives à la hauteur
  const halo = (cx, cy, dpct, alpha) => {
    const d = dpct/100 * r.h;
    return `<div class="halo" style="
      left:${(cx/100*r.w - d/2).toFixed(1)}px; top:${(cy/100*r.h - d/2).toFixed(1)}px;
      width:${d.toFixed(0)}px; height:${d.toFixed(0)}px;
      background:radial-gradient(circle, rgba(85,187,201,${alpha}) 0%, transparent 68%);
      filter:blur(${(d*0.04).toFixed(0)}px);"></div>`;
  };
  const halos = [
    halo(28, 22, 75, 0.18),
    halo(74, 40, 95, 0.14),
    halo(50, 88, 110, 0.12),
    halo(88, 75, 55, 0.16),
    // un soupçon de lime, très subtil
    `<div class="halo" style="left:${(0.16*r.w).toFixed(0)}px;top:${(0.7*r.h).toFixed(0)}px;
      width:${(0.5*r.h).toFixed(0)}px;height:${(0.5*r.h).toFixed(0)}px;
      background:radial-gradient(circle, rgba(184,230,46,0.06) 0%, transparent 70%);
      filter:blur(${(0.02*r.h).toFixed(0)}px);"></div>`,
  ].join('\n');

  const logoSize = (r.o === 'p' ? 0.030 : 0.024) * r.h;
  const logo = branded ? `
    <div class="logo" style="
      bottom:${(0.085*r.h).toFixed(0)}px;
      font-size:${logoSize.toFixed(1)}px;
      letter-spacing:${(logoSize*0.32).toFixed(1)}px;">
      FLUIDBODY<span class="plus">+</span>
    </div>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${r.w}px;height:${r.h}px;overflow:hidden}
  .bg{position:relative;width:${r.w}px;height:${r.h}px;
    background:linear-gradient(180deg,
      #0E2730 0%, #143038 16%, #1d3b44 32%, #284851 48%,
      #355861 62%, #487c80 78%, #5f9fa0 92%, #6BAEAF 100%);}
  .grain{position:absolute;inset:0;opacity:0.5;
    background:radial-gradient(circle at 50% 35%, rgba(255,255,255,0.04), transparent 60%);}
  .halo{position:absolute;border-radius:50%;}
  .jelly{position:absolute;}
  .jelly svg{width:100%;height:100%;display:block}
  .logo{position:absolute;left:0;right:0;text-align:center;
    font-family:-apple-system,'Helvetica Neue',sans-serif;font-weight:300;
    color:rgba(255,255,255,0.42);text-transform:uppercase;
    text-shadow:0 1px 20px rgba(0,0,0,0.25);}
  .logo .plus{color:rgba(184,230,46,0.55);font-weight:400}
  </style></head><body>
  <div class="bg">
    ${halos}
    <div class="grain"></div>
    ${jellies}
    ${logo}
  </div></body></html>`;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars'],
  });
  const results = [];
  for (const r of RESOS) {
    for (const branded of [false, true]) {
      const page = await browser.newPage();
      await page.setViewport({ width: r.w, height: r.h, deviceScaleFactor: 1 });
      await page.setContent(buildHTML(r, branded), { waitUntil: 'networkidle0' });
      const suffix = branded ? 'branded' : 'clean';
      const file = path.join(OUT, `${r.name}-${suffix}.png`);
      await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: r.w, height: r.h } });
      await page.close();
      const kb = (fs.statSync(file).size / 1024).toFixed(0);
      results.push(`${r.name}-${suffix}.png  ${r.w}x${r.h}  ${kb} KB`);
      console.log('✓', results[results.length - 1]);
    }
  }
  await browser.close();
  console.log('\nDONE', results.length, 'fichiers');
})().catch(e => { console.error(e); process.exit(1); });
