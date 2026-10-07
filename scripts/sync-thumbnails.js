#!/usr/bin/env node
/**
 * scripts/sync-thumbnails.js  (Phase 1, 07.10.2026)
 *
 * Génère la vignette de chaque séance à partir de SA vidéo Bunny Stream et
 * la publie pour l'app :
 *   1. lit `video_assets` (service role) : session_id, bunny_path (GUID),
 *      thumbnail_time (secondes, NULL = 30 % de la durée) ;
 *   2. signe l'URL MP4 Bunny (même Token-Auth que l'edge function) ;
 *   3. extrait UNE image nette au bon moment avec ffmpeg (1280 px, JPEG q3) ;
 *   4. dépose `thumbnails/<session_id>.jpg` dans le bucket Supabase public ;
 *   5. écrit `thumbnail_url` (avec ?v= pour casser le cache).
 *
 * Seules les séances nouvelles ou dont thumbnail_time a changé sont refaites.
 *
 * Usage :
 *   node scripts/sync-thumbnails.js                 # tout ce qui manque
 *   node scripts/sync-thumbnails.js --set p7_5=42   # choisit 0:42 pour p7_5 puis synchronise
 *   node scripts/sync-thumbnails.js --only p7_5,p3_10 --force
 *   node scripts/sync-thumbnails.js --dry-run
 *
 * Variables (fichier .env ou environnement) — JAMAIS en EXPO_PUBLIC_ :
 *   EXPO_PUBLIC_SUPABASE_URL (ou SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BUNNY_TOKEN_KEY, BUNNY_PULL_ZONE_HOST   (les mêmes que les secrets de l'edge function)
 * Prérequis : ffmpeg + ffprobe installés (brew install ffmpeg).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// --- .env minimal ----------------------------------------------------------
for (const f of ['.env', '.env.local']) {
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ONLY = (val('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const SETS = [];
args.forEach((a, i) => { if (a === '--set' && args[i + 1]) SETS.push(args[i + 1]); });
const FORCE = flag('--force');
const DRY = flag('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN_KEY = process.env.BUNNY_TOKEN_KEY;
const HOST = process.env.BUNNY_PULL_ZONE_HOST;
const missing = Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, BUNNY_TOKEN_KEY: TOKEN_KEY, BUNNY_PULL_ZONE_HOST: HOST })
  .filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error('Variables manquantes : ' + missing.join(', '));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Même algorithme que supabase/functions/sign-video-url (Bunny Token Auth SHA-256).
function signBunny(p, ttl = 900) {
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const token = crypto.createHash('sha256').update(TOKEN_KEY + p + expires).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `https://${HOST}${p}?token=${token}&expires=${expires}`;
}

function probeDuration(url) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', url], { encoding: 'utf8' });
  return parseFloat(out.trim()) || 0;
}

function grabFrame(url, t, outFile) {
  execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', url, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', '-y', outFile]);
}

(async () => {
  // --set id=secondes (accepte aussi m:ss)
  for (const s of SETS) {
    const [id, raw] = s.split('=');
    let sec = raw && raw.includes(':') ? raw.split(':').reduce((a, x) => a * 60 + parseFloat(x), 0) : parseFloat(raw);
    if (!id || !isFinite(sec)) { console.error('--set invalide : ' + s); process.exit(1); }
    if (!DRY) {
      const { error } = await supabase.from('video_assets').update({ thumbnail_time: sec }).eq('session_id', id);
      if (error) { console.error(id, error.message); process.exit(1); }
    }
    console.log(`thumbnail_time ${id} = ${sec}s`);
    if (!ONLY.includes(id)) ONLY.push(id);
  }

  let q = supabase.from('video_assets').select('session_id, bunny_path, thumbnail_time, thumbnail_url, thumbnail_synced_time');
  if (ONLY.length) q = q.in('session_id', ONLY);
  const { data, error } = await q;
  if (error) { console.error(error.message); process.exit(1); }

  const todo = data.filter((r) => FORCE || SETS.length || !r.thumbnail_url
    || (r.thumbnail_time ?? null) !== (r.thumbnail_synced_time ?? null));
  console.log(`${data.length} vidéos, ${todo.length} vignette(s) à générer${DRY ? ' (dry-run)' : ''}.`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-thumbs-'));
  let ok = 0;
  for (const r of todo) {
    const guid = String(r.bunny_path).replace(/^\/+|\/+$/g, '');
    const url = signBunny(`/${guid}/play_720p.mp4`);
    try {
      let t = r.thumbnail_time;
      if (t == null) t = Math.round(probeDuration(url) * 0.3);
      if (DRY) { console.log(`  ${r.session_id} → ${t}s`); continue; }
      const out = path.join(tmp, r.session_id + '.jpg');
      grabFrame(url, t, out);
      const buf = fs.readFileSync(out);
      const key = r.session_id + '.jpg';
      const up = await supabase.storage.from('thumbnails').upload(key, buf, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
      if (up.error) throw up.error;
      const pub = supabase.storage.from('thumbnails').getPublicUrl(key).data.publicUrl + '?v=' + Date.now();
      const upd = await supabase.from('video_assets').update({ thumbnail_url: pub, thumbnail_synced_time: r.thumbnail_time ?? null }).eq('session_id', r.session_id);
      if (upd.error) throw upd.error;
      ok += 1;
      console.log(`  ✓ ${r.session_id} (${t}s, ${Math.round(buf.length / 1024)} KB)`);
    } catch (e) {
      console.error(`  ✗ ${r.session_id} : ${e.message || e}`);
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!DRY) console.log(`${ok}/${todo.length} vignette(s) publiée(s). Elles apparaissent dans l'app au prochain lancement.`);
})();
