#!/usr/bin/env node
/**
 * scripts/planche-vignettes.js  (22.11.2026)
 *
 * Prépare le choix des vignettes : pour chaque vidéo de `video_assets`, tire
 * 9 images réparties sur la durée et les assemble en UNE planche 3 x 3
 * (lecture de gauche à droite, de haut en bas) dans `planches/<session_id>.jpg`.
 * `planches/index.json` donne la seconde de chaque case. Rien n'est publié :
 * on choisit ensuite la case, puis `sync-thumbnails.js --set id=secondes`.
 *
 * Usage :
 *   node scripts/planche-vignettes.js               # toutes les vidéos
 *   node scripts/planche-vignettes.js --only p3_7,p9_5
 *
 * Mêmes variables et prérequis que sync-thumbnails.js (.env, ffmpeg, ffprobe).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

for (const f of ['.env', '.env.local']) {
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const args = process.argv.slice(2);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ONLY = (val('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN_KEY = process.env.BUNNY_TOKEN_KEY;
const HOST = process.env.BUNNY_PULL_ZONE_HOST;
const missing = Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, BUNNY_TOKEN_KEY: TOKEN_KEY, BUNNY_PULL_ZONE_HOST: HOST })
  .filter(([, v]) => !v).map(([k]) => k);
if (missing.length) { console.error('Variables manquantes : ' + missing.join(', ')); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function signBunny(p, ttl = 1800) {
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const token = crypto.createHash('sha256').update(TOKEN_KEY + p + expires).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `https://${HOST}${p}?token=${token}&expires=${expires}`;
}

const PARTS = [0.08, 0.18, 0.28, 0.38, 0.5, 0.6, 0.7, 0.8, 0.9];
// Vidéo « Le matériel » : le lecteur coupe à 1'45 (MATERIEL_END_SEC).
const MAX_SEC = { materiel_0: 105 };

(async () => {
  let q = supabase.from('video_assets').select('session_id, bunny_path, thumbnail_time');
  if (ONLY.length) q = q.in('session_id', ONLY);
  const { data, error } = await q;
  if (error) { console.error(error.message); process.exit(1); }

  const outDir = path.join(__dirname, '..', 'planches');
  fs.mkdirSync(outDir, { recursive: true });
  const indexFile = path.join(outDir, 'index.json');
  const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-planches-'));

  data.sort((a, b) => a.session_id.localeCompare(b.session_id, undefined, { numeric: true }));
  console.log(data.length + ' vidéo(s).');
  let ok = 0;
  for (const r of data) {
    const guid = String(r.bunny_path).replace(/^\/+|\/+$/g, '');
    const url = signBunny(`/${guid}/play_720p.mp4`);
    try {
      let dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', url], { encoding: 'utf8' }).trim()) || 0;
      if (!dur) throw new Error('durée inconnue');
      if (MAX_SEC[r.session_id]) dur = Math.min(dur, MAX_SEC[r.session_id]);
      const times = PARTS.map((p) => Math.round(dur * p));
      times.forEach((t, i) => {
        execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', url, '-frames:v', '1', '-vf', 'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2', '-q:v', '4', '-y', path.join(tmp, `${r.session_id}_${i + 1}.jpg`)]);
      });
      execFileSync('ffmpeg', ['-v', 'error', '-start_number', '1', '-i', path.join(tmp, `${r.session_id}_%d.jpg`), '-vf', 'tile=3x3', '-frames:v', '1', '-q:v', '4', '-y', path.join(outDir, r.session_id + '.jpg')]);
      index[r.session_id] = { secondes: times, actuel: r.thumbnail_time ?? null, duree: Math.round(dur) };
      ok += 1;
      console.log(`  ✓ ${r.session_id} (${times.join(', ')} s)`);
    } catch (e) {
      console.error(`  ✗ ${r.session_id} : ${e.message || e}`);
    }
  }
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${ok}/${data.length} planche(s) dans planches/. Rien n'a été publié.`);
})();
