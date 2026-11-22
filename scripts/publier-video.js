#!/usr/bin/env node
/**
 * scripts/publier-video.js : lier une vidéo Bunny à une séance EXISTANTE.
 *
 *   node scripts/publier-video.js p6_5 191a3127-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *   node scripts/publier-video.js p6_5 <guid> --push     (tout d'un coup)
 *   node scripts/publier-video.js p6_5 <guid> --lieu "Minorque" --push
 *   node scripts/publier-video.js p6_5 --lieu "Minorque"  (lieu seul, vidéo déjà liée)
 *
 * Ce que fait le script :
 *   1. vérifie que la séance existe dans src/constants/data.js (et l'affiche) ;
 *   2. si BUNNY_KEY est défini, vérifie la vidéo chez Bunny (encodage fini, durée) ;
 *   3. écrit la migration supabase/migrations/<date>_video_<id>_<titre>.sql ;
 *   4. avec --push : `supabase db push`, vignette (scripts/sync-thumbnails.js,
 *      si ses variables sont dans .env), puis commit + push (scripts/fin.sh).
 *
 * --lieu "Minorque" : lieu de tournage, affiché dans l'app (« Tourné à Minorque »).
 *
 * Aucune OTA n'est nécessaire : depuis le 22.11.2026, une vidéo liée en base
 * apparaît et se lit dans l'app au prochain lancement.
 * Pour créer une NOUVELLE séance (nouveau titre), voir scripts/add-video.js.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUNNY_LIBRARY = process.env.BUNNY_LIBRARY || '627513';
const args = process.argv.slice(2);
const push = args.includes('--push');
const lieuIdx = args.indexOf('--lieu');
const lieu = lieuIdx !== -1 ? String(args[lieuIdx + 1] || '').trim() : '';
const positional = args.filter((a, i) => !a.startsWith('--') && !(lieuIdx !== -1 && i === lieuIdx + 1));
const [sessionId, guidRaw] = positional;
const lieuSeul = !guidRaw && !!lieu;

function fail(msg) { console.error('✖ ' + msg); process.exit(1); }

if (lieuIdx !== -1 && !lieu) fail('--lieu attend un nom, ex. --lieu "Minorque"');
if (!sessionId || (!guidRaw && !lieuSeul)) fail('Usage : node scripts/publier-video.js <séance, ex. p6_5> <GUID Bunny> [--push]');
if (!/^p[1-9]_\d+$/.test(sessionId)) fail('Séance invalide : ' + sessionId + ' (attendu : p3_22, p9_5…)');
const guid = (guidRaw || '').trim().toLowerCase();
if (!lieuSeul && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(guid)) fail('GUID Bunny invalide : ' + guidRaw);

// 1. La séance existe-t-elle ?
function readSeances() {
  const src = fs.readFileSync(path.join(ROOT, 'src/constants/data.js'), 'utf8');
  const start = src.indexOf('export const SEANCES_FR = ');
  if (start === -1) fail('SEANCES_FR introuvable dans data.js');
  const from = start + 'export const SEANCES_FR = '.length;
  const end = src.indexOf('\n};', from);
  return new Function('return (' + src.slice(from, end + 2) + ');')();
}
const [pk, idxStr] = sessionId.split('_');
const idx = parseInt(idxStr, 10);
const seance = (readSeances()[pk] || [])[idx];
if (!seance) fail('Aucune séance ' + sessionId + ' dans data.js. Pour une nouvelle séance : scripts/add-video.js.');
const [titre, duree, etape] = seance;
console.log('Séance  : ' + sessionId + ' « ' + titre + ' » (' + duree + ', ' + etape + ')');

// Déjà liée ?
const MIG_DIR = path.join(ROOT, 'supabase/migrations');
const migs = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
for (const f of migs) {
  const sql = fs.readFileSync(path.join(MIG_DIR, f), 'utf8');
  if (lieuSeul) break;
  if (sql.includes(guid)) console.log('⚠ Ce GUID apparaît déjà dans ' + f);
  else if (sql.includes("'" + sessionId + "'")) console.log('ℹ ' + sessionId + ' est déjà citée dans ' + f + ' : la vidéo sera remplacée.');
}

async function checkBunny() {
  const key = (process.env.BUNNY_KEY || '').trim();
  if (!key) { console.log('Bunny   : non vérifié (définis BUNNY_KEY pour contrôler la vidéo)'); return; }
  const res = await fetch('https://video.bunnycdn.com/library/' + BUNNY_LIBRARY + '/videos/' + guid, {
    headers: { AccessKey: key, accept: 'application/json' },
  });
  if (res.status === 404) fail('Bunny ne connaît pas cette vidéo dans la bibliothèque ' + BUNNY_LIBRARY + '.');
  if (res.status === 401) fail('Bunny refuse la clé (BUNNY_KEY).');
  if (!res.ok) fail('Bunny répond ' + res.status + '.');
  const v = await res.json();
  const min = Math.floor((v.length || 0) / 60);
  const sec = String((v.length || 0) % 60).padStart(2, '0');
  console.log('Bunny   : « ' + v.title + ' », ' + min + "'" + sec + "''" + ', état ' + v.status + (v.status === 4 ? ' (prête)' : ''));
  if (v.status !== 4) fail("L'encodage Bunny n'est pas terminé (état " + v.status + ', attendu 4). Réessaie dans quelques minutes.');
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  let s = '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  const last = (migs[migs.length - 1] || '').slice(0, 14);
  if (/^\d{14}$/.test(last) && s <= last) s = String(BigInt(last) + 1n);
  return s;
}

(async function main() {
  if (!lieuSeul) await checkBunny();
  const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  const slug = titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  const file = stamp() + (lieuSeul ? '_lieu_' : '_video_') + sessionId + '_' + slug + '.sql';
  const today = new Date().toISOString().slice(0, 10);
  let sql;
  if (lieuSeul) {
    sql = '-- Lieu de tournage de « ' + titre + ' » (' + sessionId + ') : ' + today + '\n'
      + 'update public.video_assets set location = ' + q(lieu) + " where session_id = '" + sessionId + "';\n";
  } else {
    sql = '-- Vidéo « ' + titre + ' » (' + sessionId + ', ' + etape + ')' + (lieu ? ', tournée à ' + lieu : '') + ' : ' + today + '\n'
      + 'insert into public.video_assets (session_id, bunny_path' + (lieu ? ', location' : '') + ') values\n'
      + "  ('" + sessionId + "', '" + guid + "'" + (lieu ? ', ' + q(lieu) : '') + ')\n'
      + 'on conflict (session_id) do update set bunny_path = excluded.bunny_path' + (lieu ? ', location = excluded.location' : '') + ';\n';
  }
  fs.writeFileSync(path.join(MIG_DIR, file), sql, 'utf8');
  console.log('✅ Migration écrite : supabase/migrations/' + file);

  if (!push) {
    console.log('\nReste à faire :\n  supabase db push\n  ./scripts/fin.sh "' + sessionId + ' ' + titre + ' : vidéo liée"');
    console.log('(ou relance avec --push pour tout enchaîner)');
    return;
  }
  execSync('supabase db push', { cwd: ROOT, stdio: 'inherit' });
  if (!lieuSeul) {
    // Vignette tirée de la vidéo : utile mais jamais bloquant.
    try {
      execSync('node scripts/sync-thumbnails.js --only ' + sessionId, { cwd: ROOT, stdio: 'inherit' });
    } catch (e) {
      console.log('⚠ Vignette non générée (ffmpeg ou variables manquantes). À relancer : node scripts/sync-thumbnails.js --only ' + sessionId);
    }
  }
  execSync('./scripts/fin.sh ' + JSON.stringify(sessionId + ' ' + titre + (lieuSeul ? ' : lieu ' + lieu : ' : vidéo liée + migration video_assets')), { cwd: ROOT, stdio: 'inherit' });
  console.log("\n✅ En ligne. La séance apparaît dans l'app au prochain lancement, sans OTA.");
})().catch(function (e) { fail(e && e.message ? e.message : String(e)); });
