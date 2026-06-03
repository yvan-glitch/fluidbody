// Générateur de wallpapers FluidBody+ — "PILATES & More" (v2).
// Esthétique : dégradé turquoise → vert lagon, méduse photo-réaliste centrale
// (tentacules COURTES) + 2-3 petites méduses, texte FLUIDBODY+ / PILATES & More.
// Puppeteer-core sur Chrome installé.
const puppeteer = require('/opt/homebrew/lib/node_modules/lighthouse/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = __dirname;

// ── Méduse réaliste, tentacules courtes ───────────────────────────────────────
// Dérivée de espace-pilates-web/.../meduse-ep-mini.svg, recolorée en palette
// turquoise/blanc translucide pour le fond lagon. viewBox 280×235.
// Cloche large en dôme (y 8→160), tentacules courtes (jusqu'à ~y 215 ≈ 35 % de
// la hauteur de cloche). Plusieurs couches : contours flous→nets, reflets,
// canaux radiaux, organe central, bord festonné, points biolumineux.
const BELL = 'M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z';

function jelly(i) {
  return `<svg viewBox="0 0 280 235" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="cBell${i}" cx="50%" cy="28%" r="58%" fx="48%" fy="22%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.60"/>
      <stop offset="22%"  stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="48%"  stop-color="#c9efef" stop-opacity="0.24"/>
      <stop offset="74%"  stop-color="#55BBC9" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#3FA8B5" stop-opacity="0.06"/>
    </radialGradient>
    <radialGradient id="cTop${i}" cx="40%" cy="18%" r="40%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.50"/>
      <stop offset="50%"  stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cOrgan${i}" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#55BBC9" stop-opacity="0.45"/>
      <stop offset="70%"  stop-color="#55BBC9" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#55BBC9" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- Tentacules courtes ondulantes -->
  <g stroke-linecap="round" fill="none">
    <path d="M 42 122 Q 60 137 50 152 T 30 186"   stroke="rgba(85,187,201,0.45)" stroke-width="1.0"/>
    <path d="M 68 135 Q 80 151 65 169 T 40 202"   stroke="rgba(85,187,201,0.42)" stroke-width="0.9"/>
    <path d="M 95 143 Q 102 159 90 178 T 70 209"  stroke="rgba(120,210,216,0.42)" stroke-width="0.9"/>
    <path d="M 118 148 Q 124 167 112 186 T 95 213" stroke="rgba(85,187,201,0.38)" stroke-width="0.75"/>
    <path d="M 140 151 Q 144 172 138 193 T 130 215" stroke="rgba(85,187,201,0.34)" stroke-width="0.7"/>
    <path d="M 162 148 Q 156 167 168 186 T 185 213" stroke="rgba(85,187,201,0.38)" stroke-width="0.75"/>
    <path d="M 185 143 Q 178 159 190 178 T 210 209" stroke="rgba(120,210,216,0.42)" stroke-width="0.9"/>
    <path d="M 212 135 Q 200 151 215 169 T 240 202" stroke="rgba(85,187,201,0.42)" stroke-width="0.9"/>
    <path d="M 238 122 Q 220 137 230 152 T 250 186" stroke="rgba(85,187,201,0.45)" stroke-width="1.0"/>
    <path d="M 82 140 Q 92 158 78 178 T 55 206"   stroke="rgba(85,187,201,0.26)" stroke-width="0.55"/>
    <path d="M 198 140 Q 188 158 202 178 T 225 206" stroke="rgba(85,187,201,0.26)" stroke-width="0.55"/>
  </g>
  <!-- Cloche : contours flous → nets -->
  <path d="${BELL}" fill="none" stroke="rgba(85,187,201,0.18)" stroke-width="18"/>
  <path d="${BELL}" fill="none" stroke="rgba(150,220,224,0.22)" stroke-width="10"/>
  <path d="${BELL}" fill="none" stroke="rgba(224,248,247,0.32)" stroke-width="5"/>
  <path d="${BELL}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>
  <!-- Reflets arc sommet -->
  <path d="M 55 62 C 75 28 115 10 160 14 C 190 17 215 32 232 55" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M 62 58 C 82 26 118 9 158 13" fill="none" stroke="rgba(255,255,255,0.40)" stroke-width="1.2" stroke-linecap="round"/>
  <!-- Remplissages cloche -->
  <path d="${BELL}" fill="rgba(255,255,255,0.30)"/>
  <path d="${BELL}" fill="url(#cBell${i})"/>
  <path d="${BELL}" fill="url(#cTop${i})"/>
  <path d="${BELL}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.2"/>
  <!-- Canaux radiaux subtils -->
  <g stroke-linecap="round" fill="none">
    <path d="M 140 105 Q 108 88 78 98"   stroke="rgba(85,187,201,0.28)" stroke-width="1.3"/>
    <path d="M 140 105 Q 115 78 100 52"  stroke="rgba(85,187,201,0.28)" stroke-width="1.3"/>
    <path d="M 140 105 Q 132 68 130 38"  stroke="rgba(85,187,201,0.24)" stroke-width="1.2"/>
    <path d="M 140 105 Q 140 66 140 36"  stroke="rgba(85,187,201,0.30)" stroke-width="1.4"/>
    <path d="M 140 105 Q 148 68 150 38"  stroke="rgba(85,187,201,0.24)" stroke-width="1.2"/>
    <path d="M 140 105 Q 165 78 180 52"  stroke="rgba(85,187,201,0.28)" stroke-width="1.3"/>
    <path d="M 140 105 Q 172 88 202 98"  stroke="rgba(85,187,201,0.28)" stroke-width="1.3"/>
  </g>
  <!-- Bord festonné -->
  <path d="M 46 122 Q 62 136 80 132 Q 96 142 112 138 Q 126 144 140 144 Q 154 144 168 138 Q 184 142 200 132 Q 218 136 234 122" stroke="rgba(85,187,201,0.50)" stroke-width="1.8" fill="none"/>
  <path d="M 58 126 Q 68 134 78 130 Q 88 138 100 134 Q 112 142 124 138 Q 132 144 140 143 Q 148 144 156 138 Q 168 142 180 134 Q 192 138 202 130 Q 212 134 222 126" stroke="rgba(150,220,224,0.35)" stroke-width="1.2" fill="none"/>
  <!-- Organe central plus dense -->
  <ellipse cx="140" cy="104" rx="20" ry="15" fill="url(#cOrgan${i})"/>
  <ellipse cx="140" cy="104" rx="11" ry="9" fill="rgba(85,187,201,0.34)"/>
  <!-- Tentacules organiques au centre (courtes) -->
  <path d="M 140 148 C 134 150 126 152 122 154 C 118 156 124 157 130 159 C 124 160 118 162 122 164 C 118 166 112 167 115 169" stroke="rgba(85,187,201,0.55)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M 140 148 C 146 150 154 152 158 154 C 162 156 156 157 150 159 C 156 160 162 162 158 164 C 162 166 168 167 165 169" stroke="rgba(85,187,201,0.55)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M 140 148 C 140 150 138 152 136 154 C 134 156 138 158 140 160 C 142 158 146 156 144 154 C 142 152 140 150 140 148" stroke="rgba(85,187,201,0.48)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <!-- Points biolumineux : highlights blancs + lime subtil -->
  <circle cx="96"  cy="60" r="2.6" fill="rgba(184,230,46,0.45)"/>
  <circle cx="184" cy="60" r="2.6" fill="rgba(184,230,46,0.45)"/>
  <circle cx="68"  cy="95" r="2.0" fill="rgba(255,255,255,0.55)"/>
  <circle cx="212" cy="95" r="2.0" fill="rgba(255,255,255,0.55)"/>
  <circle cx="140" cy="28" r="3.0" fill="rgba(255,255,255,0.75)"/>
  <circle cx="120" cy="22" r="1.6" fill="rgba(255,255,255,0.55)"/>
  <circle cx="160" cy="22" r="1.6" fill="rgba(255,255,255,0.55)"/>
  <circle cx="110" cy="44" r="1.3" fill="rgba(184,230,46,0.35)"/>
  <circle cx="170" cy="44" r="1.3" fill="rgba(184,230,46,0.35)"/>
</svg>`;
}

const JELLY_AR = 280 / 235; // largeur / hauteur du viewBox

// ── Résolutions demandées ──────────────────────────────────────────────────────
const RESOS = [
  { name: 'iphone-pro-max-1290x2796-v2',   w: 1290, h: 2796, o: 'p' },
  { name: 'iphone-pro-1179x2556-v2',       w: 1179, h: 2556, o: 'p' },
  { name: 'ipad-12-9-portrait-2048x2732-v2', w: 2048, h: 2732, o: 'p' },
  { name: 'ipad-12-9-paysage-2732x2048-v2',  w: 2732, h: 2048, o: 'l' },
  { name: 'macbook-pro-16-3456x2234-v2',     w: 3456, h: 2234, o: 'l' },
];

// ── Layouts méduses (centre en %, hf = hauteur méduse en fraction du canvas) ───
const LAYOUT = {
  p: [ // portrait : méduse principale centrée, petites flottantes
    { left: 50, top: 57, hf: 0.40, op: 1.00, rot: 1,  blur: 0 },   // principale
    { left: 79, top: 21, hf: 0.155, op: 0.82, rot: 8, blur: 0.6 }, // haut droite
    { left: 19, top: 45, hf: 0.20, op: 0.72, rot: -7, blur: 1.0 }, // milieu gauche
    { left: 70, top: 80, hf: 0.13, op: 0.52, rot: 5,  blur: 1.8 }, // bas droite subtile
  ],
  l: [ // paysage : principale au centre, satellites étalés
    { left: 50, top: 56, hf: 0.62, op: 1.00, rot: 2,  blur: 0 },
    { left: 19, top: 40, hf: 0.27, op: 0.78, rot: -6, blur: 0.8 },
    { left: 82, top: 33, hf: 0.23, op: 0.70, rot: 8,  blur: 1.2 },
    { left: 71, top: 80, hf: 0.17, op: 0.50, rot: -4, blur: 2.2 },
  ],
};

function buildHTML(r) {
  const jellies = LAYOUT[r.o].map((j, i) => {
    const hpx = j.hf * r.h;
    const wpx = hpx * JELLY_AR;
    return `<div class="jelly" style="
      left:${(j.left/100*r.w - wpx/2).toFixed(1)}px;
      top:${(j.top/100*r.h - hpx/2).toFixed(1)}px;
      width:${wpx.toFixed(1)}px; height:${hpx.toFixed(1)}px;
      opacity:${j.op}; transform:rotate(${j.rot}deg);
      filter:${j.blur ? `blur(${(j.blur*r.h/1000).toFixed(1)}px)` : 'none'};
    ">${jelly(i)}</div>`;
  }).join('\n');

  // Halos lumineux turquoise/lime très doux
  const halo = (cx, cy, dpct, color, alpha) => {
    const d = dpct/100 * r.h;
    return `<div class="halo" style="
      left:${(cx/100*r.w - d/2).toFixed(1)}px; top:${(cy/100*r.h - d/2).toFixed(1)}px;
      width:${d.toFixed(0)}px; height:${d.toFixed(0)}px;
      background:radial-gradient(circle, ${color} 0%, transparent 68%);
      filter:blur(${(d*0.04).toFixed(0)}px);"></div>`;
  };
  const halos = [
    halo(50, 55, 80, 'rgba(255,255,255,0.20)', 0),
    halo(78, 22, 55, 'rgba(255,255,255,0.16)', 0),
    halo(20, 46, 50, 'rgba(255,255,255,0.14)', 0),
    halo(50, 90, 70, 'rgba(184,230,46,0.07)', 0),
  ].join('\n');

  // Texte : FLUIDBODY + (lime) / PILATES & More
  const isP = r.o === 'p';
  const topPct = isP ? 24 : 13;
  const mainSize = (isP ? 0.034 : 0.058) * r.h;
  const subSize = (isP ? 0.0145 : 0.024) * r.h;
  const text = `
    <div class="brand" style="top:${(topPct/100*r.h).toFixed(0)}px;">
      <div class="brand-main" style="font-size:${mainSize.toFixed(1)}px; letter-spacing:${(mainSize*0.34).toFixed(1)}px;">
        FLUIDBODY<span class="plus">+</span>
      </div>
      <div class="brand-sub" style="font-size:${subSize.toFixed(1)}px; letter-spacing:${(subSize*0.48).toFixed(1)}px; margin-top:${(mainSize*0.42).toFixed(0)}px;">
        PILATES &amp; More
      </div>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${r.w}px;height:${r.h}px;overflow:hidden}
  .bg{position:relative;width:${r.w}px;height:${r.h}px;
    background:linear-gradient(165deg,
      #3FC7C7 0%, #5BCFCC 28%, #7FD9D0 56%, #95E0D6 80%, #A8E4D5 100%);}
  .grain{position:absolute;inset:0;
    background:radial-gradient(ellipse 70% 55% at 50% 42%, rgba(255,255,255,0.10), transparent 70%);}
  .halo{position:absolute;border-radius:50%;}
  .jelly{position:absolute;}
  .jelly svg{width:100%;height:100%;display:block;
    filter:drop-shadow(0 ${(0.01*r.h).toFixed(0)}px ${(0.02*r.h).toFixed(0)}px rgba(40,110,118,0.18));}
  .brand{position:absolute;left:0;right:0;text-align:center;
    font-family:-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif;}
  .brand-main{font-weight:200;color:rgba(255,255,255,0.88);
    text-transform:uppercase;text-shadow:0 2px 24px rgba(30,100,108,0.22);}
  .brand-main .plus{color:#B8E62E;font-weight:300;text-shadow:0 0 18px rgba(184,230,46,0.45);}
  .brand-sub{font-weight:300;color:rgba(255,255,255,0.72);
    text-transform:uppercase;text-shadow:0 1px 14px rgba(30,100,108,0.18);}
  </style></head><body>
  <div class="bg">
    ${halos}
    <div class="grain"></div>
    ${jellies}
    ${text}
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
    const page = await browser.newPage();
    await page.setViewport({ width: r.w, height: r.h, deviceScaleFactor: 1 });
    await page.setContent(buildHTML(r), { waitUntil: 'networkidle0' });
    const file = path.join(OUT, `${r.name}.png`);
    await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: r.w, height: r.h } });
    await page.close();
    const kb = (fs.statSync(file).size / 1024).toFixed(0);
    results.push(`${r.name}.png  ${r.w}x${r.h}  ${kb} KB`);
    console.log('✓', results[results.length - 1]);
  }
  await browser.close();
  console.log('\nDONE', results.length, 'fichiers');
})().catch(e => { console.error(e); process.exit(1); });
