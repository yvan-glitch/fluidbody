#!/usr/bin/env node
/**
 * scripts/add-video.js
 *
 * Automatise l'ajout d'une nouvelle séance vidéo dans Fluidbody.
 *
 * Met à jour automatiquement :
 *   - src/constants/data.js  (SEANCES_FR + SEANCES_EN)
 *   - Génère le SQL INSERT pour video_assets Supabase
 *
 * Usage :
 *   node scripts/add-video.js \
 *     --pilier p2 \
 *     --title-fr "Réveil du dos en 5 min" \
 *     --title-en "Back wake-up in 5 min" \
 *     --duration "5'15''" \
 *     --type Apprendre \
 *     --bunny-guid 02edcbb8-ca7c-4b58-8e64-719ad457bf92
 *
 * Optionnel :
 *   --index 3                # forcer l'index (par défaut, prend le prochain)
 *   --no-write               # dry-run, montre les changements sans rien modifier
 *   --commit                 # git add + commit auto après mise à jour
 *   --push-ota               # push une OTA update aux 2 channels (iPhone + Apple TV)
 *                              après commit. Idéal pour livrer une nouvelle séance
 *                              instantanément aux users sans rebuilder l'app.
 *
 * Étapes manuelles avant de lancer :
 *   1. Upload vidéo dans Bunny Stream, récupérer le GUID
 *   2. (Optionnel) Verifier que le pilier existe dans data.js (p1..p9)
 *
 * Workflow recommandé (full auto) :
 *   node scripts/add-video.js \\
 *     --pilier p2 --title-fr "..." --title-en "..." \\
 *     --duration "5'15''" --type Apprendre \\
 *     --bunny-guid <guid> \\
 *     --commit --push-ota
 *
 *   Puis : git push origin main + lance le SQL dans Supabase Editor.
 *   Les users iPhone + Apple TV verront la nouvelle séance au prochain
 *   lancement de l'app (pas de rebuild EAS nécessaire).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// -----------------------------------------------------------------------------
// CLI args parsing
// -----------------------------------------------------------------------------

const args = process.argv.slice(2);
const opts = {
  pilier: null,
  titleFr: null,
  titleEn: null,
  duration: null,
  type: null,
  bunnyGuid: null,
  index: null,
  noWrite: false,
  commit: false,
};

const argMap = {
  '--pilier': 'pilier',
  '--title-fr': 'titleFr',
  '--title-en': 'titleEn',
  '--duration': 'duration',
  '--type': 'type',
  '--bunny-guid': 'bunnyGuid',
  '--index': 'index',
};

opts.pushOta = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--no-write') { opts.noWrite = true; continue; }
  if (a === '--commit') { opts.commit = true; continue; }
  if (a === '--push-ota') { opts.pushOta = true; continue; }
  if (a === '--help' || a === '-h') {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    process.exit(0);
  }
  if (argMap[a]) {
    const key = argMap[a];
    opts[key] = args[++i];
    continue;
  }
  console.error(`✖ Argument inconnu: ${a}`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

const REQUIRED = ['pilier', 'titleFr', 'titleEn', 'duration', 'type', 'bunnyGuid'];
const missing = REQUIRED.filter((k) => !opts[k]);
if (missing.length) {
  console.error(`✖ Arguments manquants: ${missing.map((m) => `--${m.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`).join(', ')}`);
  console.error('Lance avec --help pour la doc complète.');
  process.exit(1);
}

const VALID_PILIERS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'];
if (!VALID_PILIERS.includes(opts.pilier)) {
  console.error(`✖ Pilier invalide: ${opts.pilier}. Doit être un de: ${VALID_PILIERS.join(', ')}`);
  process.exit(1);
}

const VALID_TYPES_FR = ['Comprendre', 'Apprendre', 'Exécuter', 'Découvrir', 'Ressentir', 'Préparer', 'Évoluer', 'Intégrer'];
if (!VALID_TYPES_FR.includes(opts.type)) {
  console.error(`✖ Type invalide: ${opts.type}. Doit être un de: ${VALID_TYPES_FR.join(', ')}`);
  process.exit(1);
}

if (!/^\d+'\d{1,2}''$/.test(opts.duration)) {
  console.error(`✖ Durée invalide: "${opts.duration}". Format attendu: "M'SS''" (ex: "5'15''")`);
  process.exit(1);
}

const BUNNY_GUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
if (!BUNNY_GUID_RE.test(opts.bunnyGuid)) {
  console.error(`✖ Bunny GUID invalide: ${opts.bunnyGuid}. Format attendu: UUID (ex: 02edcbb8-ca7c-4b58-8e64-719ad457bf92)`);
  process.exit(1);
}

// Map FR type → EN type
const TYPE_FR_EN = {
  Comprendre: 'Understand',
  Apprendre: 'Learn',
  'Exécuter': 'Execute',
  Découvrir: 'Discover',
  Ressentir: 'Feel',
  Préparer: 'Prepare',
  'Évoluer': 'Evolve',
  Intégrer: 'Integrate',
};
const typeEn = TYPE_FR_EN[opts.type] || opts.type;

// -----------------------------------------------------------------------------
// Repo paths
// -----------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_JS_PATH = path.join(REPO_ROOT, 'src', 'constants', 'data.js');

if (!fs.existsSync(DATA_JS_PATH)) {
  console.error(`✖ data.js introuvable: ${DATA_JS_PATH}`);
  process.exit(1);
}

let dataContent = fs.readFileSync(DATA_JS_PATH, 'utf8');

// -----------------------------------------------------------------------------
// Trouver la séance dans SEANCES_FR / SEANCES_EN
// -----------------------------------------------------------------------------

/**
 * Trouve le bloc `pX: [...]` dans la table cible (SEANCES_FR ou SEANCES_EN).
 * Retourne { start, end, content, lineCount } ou null si introuvable.
 */
function findPilierBlock(content, tableName, pilier) {
  // Chercher la déclaration de la table (export const SEANCES_FR = { ... })
  const tableRe = new RegExp(`(?:export\\s+const|const)\\s+${tableName}\\s*=\\s*{`);
  const tableMatch = tableRe.exec(content);
  if (!tableMatch) return null;

  const tableStart = tableMatch.index + tableMatch[0].length;
  // Trouver le matching `}` du table
  let depth = 1;
  let tableEnd = tableStart;
  while (tableEnd < content.length && depth > 0) {
    const ch = content[tableEnd];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth > 0) tableEnd++;
  }

  const tableBody = content.slice(tableStart, tableEnd);

  // Chercher la clé `p2:` à l'intérieur de la table
  const pilierKeyRe = new RegExp(`^\\s*${pilier}\\s*:\\s*\\[`, 'm');
  const pilierMatch = pilierKeyRe.exec(tableBody);
  if (!pilierMatch) return null;

  const pilierArrayStart = tableStart + pilierMatch.index + pilierMatch[0].length;
  // Trouver le matching `]` de l'array
  depth = 1;
  let pilierArrayEnd = pilierArrayStart;
  let inString = false;
  let stringChar = '';
  while (pilierArrayEnd < content.length && depth > 0) {
    const ch = content[pilierArrayEnd];
    const prev = pilierArrayEnd > 0 ? content[pilierArrayEnd - 1] : '';
    if (inString) {
      if (ch === stringChar && prev !== '\\') inString = false;
    } else {
      if (ch === "'" || ch === '"' || ch === '`') { inString = true; stringChar = ch; }
      else if (ch === '[') depth++;
      else if (ch === ']') depth--;
    }
    if (depth > 0) pilierArrayEnd++;
  }

  return {
    start: pilierArrayStart,
    end: pilierArrayEnd,
    content: content.slice(pilierArrayStart, pilierArrayEnd),
  };
}

/**
 * Compte le nombre d'entrées (lignes `[ ... ]`) dans le bloc array du pilier.
 */
function countEntries(blockContent) {
  let depth = 0;
  let count = 0;
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < blockContent.length; i++) {
    const ch = blockContent[i];
    const prev = i > 0 ? blockContent[i - 1] : '';
    if (inString) {
      if (ch === stringChar && prev !== '\\') inString = false;
    } else {
      if (ch === "'" || ch === '"' || ch === '`') { inString = true; stringChar = ch; }
      else if (ch === '[') {
        if (depth === 0) count++;
        depth++;
      } else if (ch === ']') depth--;
    }
  }
  return count;
}

// -----------------------------------------------------------------------------
// Construction des entrées
// -----------------------------------------------------------------------------

function buildEntry(title, duration, type, hasVideo) {
  return `    ['${title.replace(/'/g, "\\'")}', "${duration}", '${type}', ${hasVideo}],`;
}

const newEntryFr = buildEntry(opts.titleFr, opts.duration, opts.type, true);
const newEntryEn = buildEntry(opts.titleEn, opts.duration, typeEn, true);

// -----------------------------------------------------------------------------
// Insertion dans SEANCES_FR
// -----------------------------------------------------------------------------

function insertEntry(content, tableName, pilier, newEntry, forcedIndex) {
  const block = findPilierBlock(content, tableName, pilier);
  if (!block) {
    throw new Error(`Pilier ${pilier} introuvable dans ${tableName}`);
  }

  const currentCount = countEntries(block.content);
  const targetIndex = forcedIndex !== null ? forcedIndex : currentCount;

  if (targetIndex < 0 || targetIndex > currentCount) {
    throw new Error(`Index ${targetIndex} hors plage. ${tableName}.${pilier} a ${currentCount} entrées.`);
  }

  // Pour insérer à un index donné, on doit trouver la position dans l'array
  // Cas simple : ajouter à la fin = juste avant le `]` final
  if (targetIndex === currentCount) {
    // Trouver la fin de la dernière entrée (dernier `],` avant le `]` final)
    let insertPos = block.end; // position du `]` final
    // Reculer pour passer les espaces blancs
    while (insertPos > block.start && /\s/.test(content[insertPos - 1])) insertPos--;
    // On veut insérer avant le whitespace, en gardant la newline + indent
    const before = content.slice(0, insertPos);
    const after = content.slice(insertPos);
    return {
      content: before + '\n' + newEntry + after.replace(/^\s*\]/, '\n  ]'),
      indexAdded: targetIndex,
      totalCount: currentCount + 1,
    };
  }

  // Cas "insérer à un index milieu" : il faut trouver le i-ème `[ ... ]` du bloc
  // et insérer avant.
  // (Non implémenté pour MVP — on append à la fin par défaut.)
  throw new Error(`Insertion à un index milieu (${targetIndex}/${currentCount}) pas encore supportée. Edit data.js manuellement.`);
}

// -----------------------------------------------------------------------------
// Exécution
// -----------------------------------------------------------------------------

let resultFr, resultEn;

try {
  resultFr = insertEntry(dataContent, 'SEANCES_FR', opts.pilier, newEntryFr, opts.index !== null ? parseInt(opts.index, 10) : null);
  resultEn = insertEntry(resultFr.content, 'SEANCES_EN', opts.pilier, newEntryEn, opts.index !== null ? parseInt(opts.index, 10) : null);
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exit(1);
}

const newContent = resultEn.content;
const sessionId = `${opts.pilier}_${resultFr.indexAdded}`;

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

console.log('\n📦 Récap de la nouvelle séance');
console.log('─'.repeat(50));
console.log(`  Session ID    : ${sessionId}`);
console.log(`  Pilier        : ${opts.pilier}`);
console.log(`  Index         : ${resultFr.indexAdded} (sur ${resultFr.totalCount} séances dans ce pilier)`);
console.log(`  Titre FR      : ${opts.titleFr}`);
console.log(`  Titre EN      : ${opts.titleEn}`);
console.log(`  Durée         : ${opts.duration}`);
console.log(`  Type FR       : ${opts.type}`);
console.log(`  Type EN       : ${typeEn}`);
console.log(`  Bunny GUID    : ${opts.bunnyGuid}`);
console.log('─'.repeat(50));

if (opts.noWrite) {
  console.log('\n🔍 Mode dry-run (--no-write) — aucun fichier modifié.');
  console.log('Pour appliquer, relance sans --no-write.\n');
  process.exit(0);
}

// Écrire data.js
fs.writeFileSync(DATA_JS_PATH, newContent, 'utf8');
console.log('\n✓ data.js mis à jour');

// Sanity check : parser le fichier
try {
  execSync(`node --check "${DATA_JS_PATH}"`, { stdio: 'pipe' });
  console.log('✓ data.js parse OK (node --check)');
} catch (err) {
  console.error('✖ data.js ne parse plus après modification ! Restore via git:');
  console.error(`  git checkout -- ${DATA_JS_PATH}`);
  console.error(`  Erreur: ${err.stderr ? err.stderr.toString() : err.message}`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Generate SQL for Supabase
// -----------------------------------------------------------------------------

const sqlInsert = `INSERT INTO public.video_assets (session_id, bunny_path)\nVALUES ('${sessionId}', '${opts.bunnyGuid}');\n`;

console.log('\n📋 SQL à exécuter dans Supabase SQL Editor :');
console.log('─'.repeat(50));
console.log(sqlInsert);
console.log('─'.repeat(50));

// Save SQL to a temp file for convenience
const sqlPath = path.join(REPO_ROOT, 'tmp', `add-video-${sessionId}.sql`);
try {
  fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
  fs.writeFileSync(sqlPath, sqlInsert, 'utf8');
  console.log(`\n💾 SQL sauvegardé dans: ${sqlPath}`);
} catch (err) {
  // tmp/ dans .gitignore probablement, mais pas grave si erreur
}

console.log('\n🔗 Ouvre Supabase SQL Editor :');
console.log('  https://supabase.com/dashboard/project/ctvtjeidkqpdsmhsjsij/sql/new');
console.log('  (copie-colle le SQL ci-dessus puis Cmd+Enter)');

// -----------------------------------------------------------------------------
// Git commit
// -----------------------------------------------------------------------------

if (opts.commit) {
  console.log('\n📝 Commit git…');
  try {
    execSync(`git add "${DATA_JS_PATH}"`, { cwd: REPO_ROOT, stdio: 'inherit' });
    const commitMsg = `feat(content): add seance ${sessionId} '${opts.titleFr.replace(/'/g, "\\'")}'`;
    execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: REPO_ROOT, stdio: 'inherit' });
    console.log('\n✓ Commit créé.');
  } catch (err) {
    console.error('✖ Échec du commit. Vérifie git status.');
    process.exit(1);
  }
} else {
  console.log('\n📝 Étape suivante manuelle :');
  console.log('  git add src/constants/data.js');
  console.log(`  git commit -m "feat(content): add seance ${sessionId} '${opts.titleFr}'"`);
}

// Push OTA update — pushes the new data.js to all users on iOS + tvOS without
// rebuilding. Requires OTA configured (see eas.json `channel` per profile).
// Use this for content-only changes (new séances, copy fixes, JS bug fixes).
// Do NOT use --push-ota for changes that touch native code (deps, plugins).
if (opts.pushOta) {
  console.log('\n🚀 Push OTA update to iPhone + Apple TV channels…');
  const otaMessage = `Add séance ${sessionId}: ${opts.titleFr}`;
  try {
    execSync(`eas update --branch production --message "${otaMessage}" --non-interactive`, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    execSync(`eas update --branch production-tv --message "${otaMessage}" --non-interactive`, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    console.log('\n✓ OTA update pushed to iPhone + Apple TV.');
  } catch (err) {
    console.error('✖ OTA push failed. Lance manuellement :');
    console.error(`  eas update --branch production --message "${otaMessage}"`);
    console.error(`  eas update --branch production-tv --message "${otaMessage}"`);
    process.exit(1);
  }
}

console.log('\n🎬 Étapes restantes :');
console.log('  1. Exécute le SQL dans Supabase (voir au-dessus)');
if (!opts.commit) console.log('  2. Commit + push git');
else if (!opts.pushOta) console.log('  2. git push origin main');
if (!opts.pushOta) {
  console.log(`  ${opts.commit ? 3 : 3}. Push OTA update aux users :`);
  console.log(`     eas update --branch production --message "Add séance ${sessionId}"`);
  console.log(`     eas update --branch production-tv --message "Add séance ${sessionId}"`);
  console.log('     (ou utilise ./scripts/push-update.sh pour les 2 d\'un coup)');
}
console.log('');
console.log('💡 Pour automatiser entièrement la prochaine fois :');
console.log('   node scripts/add-video.js ...args --commit --push-ota');
console.log('');
