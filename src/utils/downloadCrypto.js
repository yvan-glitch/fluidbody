// Chiffrement fort des téléchargements hors-ligne — remplace le XOR v2.
//
// Design (2026-07-24) :
// - Clé AES-256 aléatoire PAR APPAREIL, générée au premier usage et stockée
//   dans le Keychain iOS / Keystore Android via expo-secure-store avec
//   AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY : jamais dans le bundle JS, jamais
//   sur disque, non incluse dans les sauvegardes (une restauration sur un
//   autre appareil invalide donc les fichiers → simple re-téléchargement).
// - AES-256-CTR via react-native-quick-crypto (OpenSSL natif, Nitro) — CTR
//   car on chiffre un flux vidéo : pas de padding, débit natif, accès
//   séquentiel simple. Pas de MAC : l'intégrité d'une vidéo locale n'est pas
//   un enjeu de sécurité ici (au pire, lecture qui échoue).
// - I/O en flux par chunks de 4 MB via la nouvelle API File/FileHandle
//   d'expo-file-system (bytes natifs, pas de base64 côté JS) — mémoire
//   bornée quelle que soit la taille de la vidéo.
//
// Format fichier v3 : magic "FBV3" (4 octets) + IV (16 octets) + ciphertext.
//
// Limite résiduelle assumée : pendant la lecture, un MP4 déchiffré temporaire
// existe dans cacheDirectory (purgé au démarrage suivant par sweepTempVideos
// dans DownloadManager ; pas de delete au unmount, race avec expo-av).
// La seule protection au-delà est un vrai DRM (FairPlay), hors scope.
//
// Expo Go : quick-crypto (natif) absent → isAvailable() === false et
// DownloadManager retombe sur le format XOR v2 historique.

import { File } from 'expo-file-system';

let QuickCrypto = null;
try { QuickCrypto = require('react-native-quick-crypto'); } catch (e) {}
let SecureStore = null;
try { SecureStore = require('expo-secure-store'); } catch (e) {}

const KEYCHAIN_KEY = 'fluid_dl_aes_key_v1';
const MAGIC = [0x46, 0x42, 0x56, 0x33]; // "FBV3"
export const V3_HEADER_LENGTH = 4 + 16; // magic + IV
const CHUNK_SIZE = 4 * 1024 * 1024;

// --- helpers hex (évite de dépendre du polyfill Buffer) ---
function bytesToHex(bytes) {
  const hexChars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += hexChars[(bytes[i] >> 4) & 0xf] + hexChars[bytes[i] & 0xf];
  }
  return out;
}

function hexToBytes(hex) {
  const len = hex.length >> 1;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const b = parseInt(hex.substr(i * 2, 2), 16);
    if (Number.isNaN(b)) return null;
    out[i] = b;
  }
  return out;
}

// Détection magic "FBV3" sur les 4 premiers octets d'un buffer.
export function hasV3Magic(bytes) {
  if (!bytes || bytes.length < 4) return false;
  for (let i = 0; i < 4; i++) if (bytes[i] !== MAGIC[i]) return false;
  return true;
}

// --- disponibilité du crypto natif (memoïsé) ---
let _available = null;
export function isAvailable() {
  if (_available !== null) return _available;
  try {
    if (!QuickCrypto || !SecureStore) { _available = false; return false; }
    // Self-test minuscule : si le module Nitro n'est pas linké (Expo Go),
    // createCipheriv throw ici plutôt qu'au milieu d'un téléchargement.
    const iv = new Uint8Array(16);
    const key = new Uint8Array(32);
    const c = QuickCrypto.createCipheriv('aes-256-ctr', key, iv);
    c.update(new Uint8Array(1));
    c.final();
    _available = true;
  } catch (e) {
    _available = false;
  }
  return _available;
}

// --- clé par appareil ---
// Audit sécu 26/07 : la promesse en cours est mémoïsée (pattern inflight)
// pour empêcher deux appels concurrents de générer deux clés dont la seconde
// écraserait la première dans le Keychain — un fichier tout juste chiffré
// serait alors devenu illisible.
let _cachedKey = null;
let _keyInflight = null;
export function getOrCreateKey() {
  if (_cachedKey) return Promise.resolve(_cachedKey);
  if (_keyInflight) return _keyInflight;
  _keyInflight = (async function () {
    if (!SecureStore || !QuickCrypto) throw new Error('Secure crypto unavailable');
    const stored = await SecureStore.getItemAsync(KEYCHAIN_KEY);
    if (stored) {
      const bytes = hexToBytes(stored);
      if (bytes && bytes.length === 32) { _cachedKey = bytes; return bytes; }
      // Valeur corrompue — on régénère (les .enc v3 existants deviennent
      // illisibles → re-téléchargement, cas pathologique acceptable).
    }
    const raw = QuickCrypto.randomBytes(32);
    const key = new Uint8Array(raw.buffer ? raw.buffer.slice(raw.byteOffset, raw.byteOffset + 32) : raw);
    await SecureStore.setItemAsync(KEYCHAIN_KEY, bytesToHex(key), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    _cachedKey = key;
    return key;
  })();
  _keyInflight.catch(function () { _keyInflight = null; });
  _keyInflight.then(function () { _keyInflight = null; });
  return _keyInflight;
}

function toUint8(buf) {
  if (buf instanceof Uint8Array) return buf;
  return new Uint8Array(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) : buf);
}

// Copie DÉFENSIVE dans un Uint8Array possédé par JS (fix 2026-07-25).
// Les buffers rendus par expo-file-system (readBytes) et quick-crypto
// (update/final) sont adossés à des ArrayBuffer natifs de leurs modules
// respectifs ; les passer directement d'un module à l'autre peut lever
// « Exception in HostFunction: unordered_map::at: key not found » (le
// registre Nitro ne connaît pas le buffer étranger). Une copie JS pure
// coupe toute dépendance native. Coût : ~2 copies de 4 MB par chunk,
// négligeable devant l'I/O.
function ownedCopy(buf) {
  return new Uint8Array(toUint8(buf));
}

// Laisse respirer le thread JS entre deux chunks (UI/progress).
function tick() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

// Copie chiffrée srcUri (MP4 clair) → destUri (format v3). Écrase dest.
export async function encryptFileToV3(srcUri, destUri) {
  const key = await getOrCreateKey();
  const iv = toUint8(QuickCrypto.randomBytes(16));
  const cipher = QuickCrypto.createCipheriv('aes-256-ctr', key, iv);

  const src = new File(srcUri);
  const dest = new File(destUri);
  try { dest.delete(); } catch (e) {}
  dest.create({ intermediates: true });

  const inHandle = src.open();
  const outHandle = dest.open();
  try {
    outHandle.writeBytes(new Uint8Array(MAGIC));
    outHandle.writeBytes(ownedCopy(iv));
    const total = inHandle.size || 0;
    let done = 0;
    while (done < total) {
      const chunk = inHandle.readBytes(Math.min(CHUNK_SIZE, total - done));
      if (!chunk || chunk.length === 0) break;
      done += chunk.length;
      outHandle.writeBytes(ownedCopy(cipher.update(ownedCopy(chunk))));
      if (done < total) await tick();
    }
    const fin = cipher.final();
    if (fin && fin.length) outHandle.writeBytes(ownedCopy(fin));
  } finally {
    try { inHandle.close(); } catch (e) {}
    try { outHandle.close(); } catch (e) {}
  }
}

// Déchiffre srcUri (v3) → destUri (MP4 clair). Renvoie false si le fichier
// n'est pas un v3 valide (mauvais magic) — le caller gère les formats legacy.
export async function decryptV3ToFile(srcUri, destUri) {
  const key = await getOrCreateKey();
  const src = new File(srcUri);
  const inHandle = src.open();
  let outHandle = null;
  try {
    const header = ownedCopy(inHandle.readBytes(V3_HEADER_LENGTH));
    if (!hasV3Magic(header) || header.length < V3_HEADER_LENGTH) return false;
    const iv = header.slice(4, 20);
    const decipher = QuickCrypto.createDecipheriv('aes-256-ctr', key, iv);

    const dest = new File(destUri);
    try { dest.delete(); } catch (e) {}
    dest.create({ intermediates: true });
    outHandle = dest.open();

    const total = inHandle.size || 0;
    let done = V3_HEADER_LENGTH;
    while (done < total) {
      const chunk = inHandle.readBytes(Math.min(CHUNK_SIZE, total - done));
      if (!chunk || chunk.length === 0) break;
      done += chunk.length;
      outHandle.writeBytes(ownedCopy(decipher.update(ownedCopy(chunk))));
      if (done < total) await tick();
    }
    const fin = decipher.final();
    if (fin && fin.length) outHandle.writeBytes(ownedCopy(fin));
    return true;
  } finally {
    try { inHandle.close(); } catch (e) {}
    if (outHandle) { try { outHandle.close(); } catch (e) {} }
  }
}

// Lit les premiers octets d'un fichier (détection de format sans tout lire).
export function readFirstBytes(uri, length) {
  const handle = new File(uri).open();
  try {
    return handle.readBytes(length);
  } finally {
    try { handle.close(); } catch (e) {}
  }
}
