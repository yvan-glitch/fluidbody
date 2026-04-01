#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Génère un SVG 1024x1024 (fond noir) avec la méduse FluidBody,
 * 7 tentacules fines supplémentaires, et la signature FLUIDBODY / PILATES.
 *
 * Output: /Users/xvan/fluidbody/assets/icon_new.svg
 */

// --- Reprise de la logique "Meduse()" (version statique) ---------------------

function tentaclePath(bx, by, angle, length, t, phase, amp) {
  const N = 12;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const px = -sin;
  const py = cos;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const dist = s * length;
    const wave = Math.sin(s * Math.PI * 4 - t * 2.5 + phase) * amp * Math.pow(s, 0.5);
    pts.push([bx + cos * dist + px * wave, by + sin * dist + py * wave]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = i > 1 ? pts[i - 2] : pts[0];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = i < pts.length - 1 ? pts[i + 1] : p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) * 0.25;
    const cp1y = p1[1] + (p2[1] - p0[1]) * 0.25;
    const cp2x = p2[0] - (p3[0] - p1[0]) * 0.25;
    const cp2y = p2[1] - (p3[1] - p1[1]) * 0.25;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

const TENTS2 = [
  { sx: 42,  sy: 122, angle: Math.PI * 0.560, len: 300, phase: 0.0, amp: 16, color: 'rgba(220,228,255,0.55)', w: 0.9 },
  { sx: 68,  sy: 135, angle: Math.PI * 0.535, len: 350, phase: 1.4, amp: 20, color: 'rgba(215,225,255,0.50)', w: 0.75 },
  { sx: 95,  sy: 143, angle: Math.PI * 0.518, len: 320, phase: 2.7, amp: 18, color: 'rgba(225,232,255,0.50)', w: 0.80 },
  { sx: 118, sy: 148, angle: Math.PI * 0.508, len: 400, phase: 0.8, amp: 26, color: 'rgba(218,226,255,0.42)', w: 0.62 },
  { sx: 140, sy: 151, angle: Math.PI * 0.500, len: 440, phase: 2.1, amp: 30, color: 'rgba(220,228,255,0.38)', w: 0.55 },
  { sx: 162, sy: 148, angle: Math.PI * 0.492, len: 400, phase: 1.2, amp: 26, color: 'rgba(218,226,255,0.42)', w: 0.62 },
  { sx: 185, sy: 143, angle: Math.PI * 0.482, len: 320, phase: 0.4, amp: 18, color: 'rgba(225,232,255,0.50)', w: 0.80 },
  { sx: 212, sy: 135, angle: Math.PI * 0.465, len: 350, phase: 3.1, amp: 20, color: 'rgba(215,225,255,0.50)', w: 0.75 },
  { sx: 238, sy: 122, angle: Math.PI * 0.440, len: 300, phase: 1.9, amp: 16, color: 'rgba(220,228,255,0.55)', w: 0.9 },
  { sx: 82,  sy: 140, angle: Math.PI * 0.525, len: 470, phase: 1.0, amp: 36, color: 'rgba(210,220,255,0.28)', w: 0.48 },
  { sx: 198, sy: 140, angle: Math.PI * 0.475, len: 450, phase: 2.5, amp: 32, color: 'rgba(210,220,255,0.28)', w: 0.48 },
  { sx: 55,  sy: 128, angle: Math.PI * 0.548, len: 260, phase: 3.5, amp: 14, color: 'rgba(222,230,255,0.45)', w: 0.70 },
  { sx: 225, sy: 128, angle: Math.PI * 0.452, len: 260, phase: 0.7, amp: 14, color: 'rgba(222,230,255,0.45)', w: 0.70 },
];

function rgbaToSvg(rgba) {
  // Convert "rgba(r,g,b,a)" to { color: "rgb(r,g,b)", opacity: a }
  const m = String(rgba).match(/rgba\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/i);
  if (!m) return { color: rgba, opacity: null };
  const r = Math.round(parseFloat(m[1]));
  const g = Math.round(parseFloat(m[2]));
  const b = Math.round(parseFloat(m[3]));
  const a = parseFloat(m[4]);
  return { color: `rgb(${r},${g},${b})`, opacity: a };
}

function buildMeduseGroup({ scale, tx, ty, idPrefix = 'med', lenFactor = 0.42, ampFactor = 0.65, centralMode = 'short' }) {
  const tick = 0; // statique
  const tentPaths = TENTS2.map(t => tentaclePath(t.sx, t.sy, t.angle, t.len * lenFactor, tick, t.phase, t.amp * ampFactor));
  const tentacleSvg = tentPaths.map((d, i) => {
    const stroke = rgbaToSvg(TENTS2[i].color);
    const sw = TENTS2[i].w;
    const op = stroke.opacity != null ? ` stroke-opacity="${stroke.opacity}"` : '';
    return `<path d="${d}" stroke="${stroke.color}"${op} stroke-width="${sw}" fill="none" stroke-linecap="round" />`;
  }).join('\n');

  return `
  <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(4)})">
    <defs>
      <radialGradient id="${idPrefix}_bellGrad" cx="50%" cy="28%" r="60%" fx="48%" fy="22%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.75"/>
        <stop offset="20%" stop-color="#f8faff" stop-opacity="0.58"/>
        <stop offset="45%" stop-color="#f0f4ff" stop-opacity="0.40"/>
        <stop offset="70%" stop-color="#e4ecff" stop-opacity="0.22"/>
        <stop offset="88%" stop-color="#d8e4ff" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#c8d8f8" stop-opacity="0.04"/>
      </radialGradient>
      <radialGradient id="${idPrefix}_topGlow" cx="40%" cy="20%" r="42%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/>
        <stop offset="50%" stop-color="#f8f8ff" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- Tentacules -->
    ${tentacleSvg}
    ${centralMode === 'long'
      ? `
    <!-- Tentacules centrales (longues) -->
    <path d="M 140 148 C 132 156.4 120 165.4 124 175 C 116 181 110 188.2 114 195.4 C 110 201.4 104 209.2 108 217.6"
      stroke="rgba(200,210,255,0.55)" stroke-width="2.0" fill="none" stroke-linecap="round"/>
    <path d="M 140 148 C 148 156.4 160 165.4 156 175 C 164 181 170 188.2 166 195.4 C 170 201.4 176 209.2 172 217.6"
      stroke="rgba(200,210,255,0.55)" stroke-width="2.0" fill="none" stroke-linecap="round"/>
    <path d="M 140 148 C 140 156.4 138 165.4 136 173.2 C 134 181 138 188.2 140 194.8 C 142 188.2 146 181 144 173.2 C 142 165.4 140 156.4 140 148"
      stroke="rgba(210,218,255,0.46)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      `
      : `
    <!-- Tentacules centrales (raccourcies) -->
    <path d="M 140 148 C 134 160 128 170 124 182 C 120 192 124 202 130 210 C 126 218 122 228 124 240"
      stroke="rgba(200,210,255,0.65)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M 140 148 C 146 160 152 170 156 182 C 160 192 156 202 150 210 C 154 218 158 228 156 240"
      stroke="rgba(200,210,255,0.65)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M 140 148 C 140 162 139 176 137 188 C 135 198 138 206 140 214 C 142 206 145 198 143 188 C 141 176 140 162 140 148"
      stroke="rgba(210,218,255,0.58)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      `
    }

    <!-- Halo / contour -->
    <path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
      fill="none" stroke="rgba(220,230,255,0.15)" stroke-width="18" />
    <path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
      fill="none" stroke="rgba(230,235,255,0.20)" stroke-width="10" />
    <path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
      fill="none" stroke="rgba(240,242,255,0.30)" stroke-width="5" />
    <path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
      fill="none" stroke="rgba(255,255,255,0.90)" stroke-width="1.5" />
    <path d="M 55 62 C 75 28 115 10 160 14 C 190 17 215 32 232 55" fill="none" stroke="rgba(255,255,255,0.70)" stroke-width="2.5" stroke-linecap="round" />
    <path d="M 62 58 C 82 26 118 9 158 13" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.2" stroke-linecap="round" />

    <!-- Cloche -->
    <path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="rgba(240,245,255,0.28)" />
    <path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#${idPrefix}_bellGrad)" />
    <path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#${idPrefix}_topGlow)" />
    <path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="1.2" />

    <!-- Traits internes -->
    <path d="M 140 105 Q 108 88 78  98"  stroke="rgba(200,215,255,0.25)" stroke-width="1.3" fill="none"/>
    <path d="M 140 105 Q 115 78 100 52"  stroke="rgba(200,215,255,0.25)" stroke-width="1.3" fill="none"/>
    <path d="M 140 105 Q 132 68 130 38"  stroke="rgba(205,218,255,0.22)" stroke-width="1.2" fill="none"/>
    <path d="M 140 105 Q 140 66 140 36"  stroke="rgba(210,220,255,0.26)" stroke-width="1.4" fill="none"/>
    <path d="M 140 105 Q 148 68 150 38"  stroke="rgba(205,218,255,0.22)" stroke-width="1.2" fill="none"/>
    <path d="M 140 105 Q 165 78 180 52"  stroke="rgba(200,215,255,0.25)" stroke-width="1.3" fill="none"/>
    <path d="M 140 105 Q 172 88 202 98"  stroke="rgba(200,215,255,0.25)" stroke-width="1.3" fill="none"/>
    <path d="M 140 105 Q 95  95  68 108"  stroke="rgba(200,212,255,0.20)" stroke-width="1.1" fill="none"/>
    <path d="M 140 105 Q 185 95 212 108"  stroke="rgba(200,212,255,0.20)" stroke-width="1.1" fill="none"/>

    <!-- Frange -->
    <path d="M 46 122 Q 62 136 80 132 Q 96 142 112 138 Q 126 144 140 144 Q 154 144 168 138 Q 184 142 200 132 Q 218 136 234 122"
      stroke="rgba(220,228,255,0.50)" stroke-width="1.8" fill="none" />
    <path d="M 58 126 Q 68 134 78 130 Q 88 138 100 134 Q 112 142 124 138 Q 132 144 140 143 Q 148 144 156 138 Q 168 142 180 134 Q 192 138 202 130 Q 212 134 222 126"
      stroke="rgba(228,235,255,0.35)" stroke-width="1.2" fill="none" />

    <!-- Particules -->
    <circle cx="96"  cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
    <circle cx="184" cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
    <circle cx="68"  cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
    <circle cx="212" cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
    <circle cx="140" cy="28" r="2.8" fill="rgba(240,250,255,0.95)" />
    <circle cx="120" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
    <circle cx="160" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
  </g>
  `;
}

function buildExtraTentacles() {
  // 7 tentacules fines, translucides, ondulantes, opacité décroissante vers le bas
  const xs = [356, 402, 448, 512, 576, 622, 668];
  // Max longueur 180px: si baseY=500, fin à 680.
  const baseY = 500;
  const bottomY = baseY + 180;

  const paths = xs.map((x, i) => {
    const sway = 26 + i * 2;
    const x1 = x - sway * 0.6;
    const x2 = x + sway * 0.9;
    const x3 = x - sway * 0.4;
    const y1 = baseY + 55;
    const y2 = baseY + 120;
    const y3 = bottomY;
    return `<path d="M ${x} ${baseY} C ${x1} ${y1}, ${x2} ${y2}, ${x3} ${y3}" stroke="url(#extraTentGrad)" stroke-width="${1.2 + (i % 3) * 0.2}" fill="none" stroke-linecap="round" />`;
  }).join('\n');

  return `
  <defs>
    <linearGradient id="extraTentGrad" x1="0" y1="${baseY}" x2="0" y2="${bottomY}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgb(235,248,255)" stop-opacity="0.48"/>
      <stop offset="45%" stop-color="rgb(200,235,255)" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="rgb(200,235,255)" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${paths}
  `;
}

function buildSvg() {
  const W = 1024;
  const H = 1024;

  // Icône: méduse agrandie et centrée
  const scale = 2.05 * 1.5;
  const tx = (W / 2) - 140 * scale;
  // Centre visuel approximatif (bbox ~ y: 8..335 => centre ~172)
  const ty = (H / 2) - 172 * scale + 80;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <!-- Dégradé vertical: #00B4D8 (haut) -> #005f7a (centre) -> #081525 (bas) -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
      <!-- Dégradé sur les 60% supérieurs, bas sombre -->
      <stop offset="0%" stop-color="#00B4D8" />
      <stop offset="30%" stop-color="#005f7a" />
      <stop offset="60%" stop-color="#081525" />
      <stop offset="100%" stop-color="#081525" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bgGrad)" />

  ${buildMeduseGroup({ scale, tx, ty, idPrefix: 'icon', centralMode: 'short' })}
</svg>
`;
}

function generateIcon() {
  const out = '/Users/xvan/fluidbody/assets/icon_new.svg';
  const outSvg = '/Users/xvan/fluidbody/assets/icon.svg';
  const outPng = '/Users/xvan/fluidbody/assets/icon.png';
  const outPngNew = '/Users/xvan/fluidbody/assets/icon_new.png';
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const svg = buildSvg();
  fs.writeFileSync(out, svg, 'utf8');
  fs.writeFileSync(outSvg, svg, 'utf8');
  console.log(`Wrote ${out}`);
  execSync(`npx @resvg/resvg-js-cli --fit-width 1024 --fit-height 1024 "${outSvg}" "${outPng}"`, { stdio: 'inherit' });
  execSync(`npx @resvg/resvg-js-cli --fit-width 1024 --fit-height 1024 "${out}" "${outPngNew}"`, { stdio: 'inherit' });
}

function generateWebLogo() {
  const W = 2048;
  const H = 2048;

  // Méduse agrandie, tiers supérieur
  const baseScale = 2.05;
  const scale = baseScale * 1.8;
  const tx = (W / 2) - 140 * scale;
  const ty = 160;

  // Tentacules extra: proportionnelles et arrêt avant le texte
  const extraBaseY = 980;
  const extraLen = 420; // stop à 1400, avant le texte
  const extraBottomY = extraBaseY + extraLen;
  const xs = [712, 804, 896, 1024, 1152, 1244, 1336];
  const extraTentPaths = xs.map((x, i) => {
    const sway = 60 + i * 4;
    const x1 = x - sway * 0.6;
    const x2 = x + sway * 0.9;
    const x3 = x - sway * 0.4;
    const y1 = extraBaseY + extraLen * 0.35;
    const y2 = extraBaseY + extraLen * 0.70;
    const y3 = extraBottomY;
    return `<path d="M ${x} ${extraBaseY} C ${x1} ${y1}, ${x2} ${y2}, ${x3} ${y3}" stroke="url(#web_extraTentGrad)" stroke-width="${2.0 + (i % 3) * 0.25}" fill="none" stroke-linecap="round" />`;
  }).join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <!-- Dégradé vertical: #00B4D8 (haut) -> #005f7a (centre) -> #081525 (bas) -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
      <!-- Dégradé sur les 60% supérieurs, bas sombre -->
      <stop offset="0%" stop-color="#00B4D8" />
      <stop offset="30%" stop-color="#005f7a" />
      <stop offset="60%" stop-color="#081525" />
      <stop offset="100%" stop-color="#081525" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bgGrad)" />

  <defs>
    <linearGradient id="web_extraTentGrad" x1="0" y1="${extraBaseY}" x2="0" y2="${extraBottomY}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgb(235,248,255)" stop-opacity="0.42"/>
      <stop offset="45%" stop-color="rgb(200,235,255)" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="rgb(200,235,255)" stop-opacity="0"/>
    </linearGradient>
  </defs>

  ${extraTentPaths}
  ${buildMeduseGroup({ scale, tx, ty, idPrefix: 'web', lenFactor: 0.42, ampFactor: 0.65, centralMode: 'short' })}

  <text x="1024" y="1560"
        text-anchor="middle"
        fill="rgba(255,255,255,0.95)"
        font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-size="140"
        font-weight="200"
        letter-spacing="20">
    FLUIDBODY
  </text>
  <text x="1024" y="1820"
        text-anchor="middle"
        fill="#4DD9E8"
        font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-size="100"
        font-weight="300"
        letter-spacing="24">
    PILATES
  </text>
</svg>`;

  const outSvg = '/Users/xvan/fluidbody/assets/logo_web.svg';
  const outPng = '/Users/xvan/fluidbody/assets/logo_web.png';
  fs.mkdirSync(path.dirname(outSvg), { recursive: true });
  fs.writeFileSync(outSvg, svg, 'utf8');

  execSync(`npx @resvg/resvg-js-cli "${outSvg}" "${outPng}"`, { stdio: 'inherit' });
  console.log('Logo web généré !');
}

function generateWallpaper() {
  // iPhone 17 Pro Max (résolution native)
  const W = 1320;
  const H = 2868;

  // Méduse: centrée, légèrement au-dessus du centre vertical
  const baseScale = 2.05;
  const scale = baseScale * 2.2;
  const tx = (W / 2) - 140 * scale;
  const ty = 640; // place la cloche dans le tiers supérieur

  // Particules/bulles (fixes, non aléatoires à chaque run)
  const particles = [
    { x: 180, y: 260, r: 2.2, o: 0.55 },
    { x: 1020, y: 340, r: 1.6, o: 0.45 },
    { x: 860, y: 520, r: 2.6, o: 0.35 },
    { x: 420, y: 610, r: 1.8, o: 0.35 },
    { x: 1180, y: 740, r: 1.4, o: 0.30 },
    { x: 260, y: 820, r: 1.2, o: 0.26 },
    { x: 1060, y: 980, r: 2.0, o: 0.22 },
    { x: 640, y: 1120, r: 1.6, o: 0.18 },
    { x: 980, y: 1320, r: 1.9, o: 0.16 },
    { x: 360, y: 1500, r: 1.5, o: 0.14 },
    { x: 820, y: 1680, r: 1.2, o: 0.12 },
  ].map(p => `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="rgba(200,235,255,${p.o})" />`).join('\n');

  // Tentacules longues additionnelles en coordonnées wallpaper (élégantes + fade)
  const tentStartY = 1480;
  // Raccourci total: -40% puis -50% supplémentaire => longueur * 0.3
  const tentEndY = tentStartY + Math.round((2360 - 1480) * 0.3);
  const tentXs = [440, 520, 600, 660, 720, 800, 880];
  const longTent = tentXs.map((x, i) => {
    const sway = 70 + i * 6;
    const x1 = x - sway * 0.55;
    const x2 = x + sway * 0.85;
    const x3 = x - sway * 0.35;
    const y1 = tentStartY + 240;
    const y2 = tentStartY + 520;
    const y3 = tentEndY;
    return `<path d="M ${x} ${tentStartY} C ${x1} ${y1}, ${x2} ${y2}, ${x3} ${y3}" stroke="url(#wpTentGrad)" stroke-width="${2.0 + (i % 3) * 0.25}" fill="none" stroke-linecap="round" />`;
  }).join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
      <!-- Dégradé sur les 60% supérieurs, bas sombre -->
      <stop offset="0%" stop-color="#00B4D8" />
      <stop offset="30%" stop-color="#005f7a" />
      <stop offset="60%" stop-color="#081525" />
      <stop offset="100%" stop-color="#081525" />
    </linearGradient>
    <linearGradient id="wpTentGrad" x1="0" y1="${tentStartY}" x2="0" y2="${tentEndY}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgb(235,248,255)" stop-opacity="0.42"/>
      <stop offset="40%" stop-color="rgb(200,235,255)" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="rgb(200,235,255)" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bgGrad)" />

  ${particles}

  ${buildMeduseGroup({ scale, tx, ty, idPrefix: 'wp', lenFactor: 0.92 * 0.3, ampFactor: 0.85, centralMode: 'long' })}

  ${longTent}

  <text x="${W / 2}" y="2090"
        text-anchor="middle"
        fill="rgba(255,255,255,0.95)"
        font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-size="180"
        font-weight="200"
        letter-spacing="16">
    FLUIDBODY
  </text>
  <text x="${W / 2}" y="2335"
        text-anchor="middle"
        fill="#4DD9E8"
        font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-size="100"
        font-weight="300"
        letter-spacing="18">
    PILATES
  </text>
</svg>`;

  const outSvg = '/Users/xvan/fluidbody/assets/wallpaper_iphone.svg';
  const outPng = '/Users/xvan/fluidbody/assets/wallpaper_iphone.png';
  fs.mkdirSync(path.dirname(outSvg), { recursive: true });
  fs.writeFileSync(outSvg, svg, 'utf8');
  execSync(`npx @resvg/resvg-js-cli "${outSvg}" "${outPng}"`, { stdio: 'inherit' });
  console.log("Fond d'écran généré !");
}

if (require.main === module) {
  const mode = process.argv[2];
  if (mode === 'icon') {
    generateIcon();
  } else {
    generateIcon();
    generateWebLogo();
    generateWallpaper();
  }
}

