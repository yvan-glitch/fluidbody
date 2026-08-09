// Expo SDK 54 : les méthodes async (`getInfoAsync`, `downloadAsync`,
// `readAsStringAsync`, `writeAsStringAsync`, `makeDirectoryAsync`,
// `deleteAsync`, `createDownloadResumable`, …) ont été dépréciées du
// module principal et déplacées vers `expo-file-system/legacy`. La nouvelle
// API (`File` / `Directory` classes) sera adoptée quand on aura le temps
// de réécrire DownloadManager autour. Pour l'instant on garde le path
// migration officiel — comportement identique, zéro changement au reste
// du code de ce fichier.
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSignedVideoUrl, buildSessionId } from '../utils/videoUrl';
import * as DLCrypto from '../utils/downloadCrypto';

const DOWNLOADS_DIR = FileSystem.documentDirectory + 'downloads/';
const DOWNLOADS_KEY = 'fluid_downloads';

// FORMAT v3 (2026-07-24) — chiffrement fort : AES-256-CTR natif
// (react-native-quick-crypto) avec clé aléatoire par appareil stockée dans le
// Keychain (expo-secure-store). Voir src/utils/downloadCrypto.js pour le
// design complet. TOUS les nouveaux téléchargements sont en v3.
//
// Audit sécu (2026-08-08) : le fallback d'ÉCRITURE en XOR v2 a été supprimé.
// Le XOR v2 n'était pas du chiffrement (keystream répété, clé = SHA-256 d'un
// seed constant présent dans le bundle JS → dérivable, .enc v2 = clair sur
// disque). Désormais, si le crypto natif est indisponible (Expo Go) ou lève
// l'erreur Nitro, le téléchargement ÉCHOUE proprement (voir downloadVideo) au
// lieu de produire un fichier v2.
//
// La LECTURE des fichiers v2 déjà présents sur disque (téléchargés avant ce
// changement) reste supportée : getLocalVideoUri les déchiffre et les migre
// opportunément vers v3 à la première lecture. Le seed ci-dessous n'est donc
// conservé QUE pour ce déchiffrement/migration de l'existant — il ne protège
// rien (constant, dérivable du bundle JS).
const ENCRYPTION_SEED = 'com.ytissot.fluidbody.offline.v1';

// Ensure downloads directory exists
async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
}

// Generate encryption key from seed
async function getEncryptionKey() {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, ENCRYPTION_SEED);
}

// XOR encrypt/decrypt buffer (same operation for both)
function xorCrypt(data, keyHex) {
  const keyBytes = [];
  for (let i = 0; i < keyHex.length; i += 2) {
    keyBytes.push(parseInt(keyHex.substr(i, 2), 16));
  }
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return result;
}

// Get download state from AsyncStorage
async function getDownloads() {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

// Save download state
async function saveDownloads(downloads) {
  await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
}

// Get the encrypted file path for a session
function getEncPath(pilierKey, seanceIndex) {
  return DOWNLOADS_DIR + pilierKey + '_' + seanceIndex + '.enc';
}

// Download and encrypt a video. The URL is signed server-side; the caller
// only supplies the session id, never a raw Bunny URL.
//
// `quality` (optionnel) : 'eco' | 'standard' | 'hd' — passé à
// getSignedVideoUrl pour récupérer le variant adéquat. Persisté dans
// l'entrée AsyncStorage pour l'affichage dans Mes téléchargements.
// Returns a callback to track progress: onProgress(progress 0-1)
async function downloadVideo(pilierKey, seanceIndex, onProgress, quality) {
  await ensureDir();
  const sessionId = buildSessionId(pilierKey, seanceIndex);
  if (!sessionId) throw new Error('Invalid session');
  const mp4Url = await getSignedVideoUrl(sessionId, 'mp4', undefined, quality);
  if (!mp4Url) throw new Error('Could not sign download URL');

  const downloads = await getDownloads();
  const dlKey = pilierKey + '_' + seanceIndex;
  downloads[dlKey] = { status: 'downloading', date: new Date().toISOString(), size: 0, quality: quality || 'standard' };
  await saveDownloads(downloads);

  try {
    const tempPath = FileSystem.cacheDirectory + 'dl_temp_' + dlKey + '.mp4';
    const encPath = getEncPath(pilierKey, seanceIndex);

    // Download with progress.
    // Fix 2026-07-25 : sur New Architecture, le callback de progression de
    // createDownloadResumable peut lever « Exception in HostFunction:
    // unordered_map::at: key not found » (registre natif du subscriber).
    // Plan A = resumable avec progression ; si cette erreur précise sort,
    // plan B = downloadAsync simple (pas de callback natif) avec une
    // progression simulée par polling de la taille du fichier temporaire.
    let result = null;
    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        mp4Url, tempPath, {},
        function(downloadProgress) {
          if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
            onProgress(downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite);
          }
        }
      );
      result = await downloadResumable.downloadAsync();
    } catch (dlErr) {
      const isNitroMapErr = String((dlErr && dlErr.message) || '').indexOf('unordered_map') !== -1;
      if (!isNitroMapErr) throw dlErr;
      try {
        const Sentry = require('@sentry/react-native');
        Sentry.captureException(dlErr);
      } catch (se) {}
      try { await FileSystem.deleteAsync(tempPath, { idempotent: true }); } catch (de) {}
      // Progression simulée : poll la taille du temp toutes les 500 ms.
      let pollHandle = null;
      if (onProgress) {
        pollHandle = setInterval(async function() {
          try {
            const info = await FileSystem.getInfoAsync(tempPath);
            if (info && info.exists && info.size > 0) {
              // Sans totalBytes connu : approche asymptotique vers 90%.
              const mb = info.size / (1024 * 1024);
              onProgress(Math.min(0.9, mb / (mb + 8)));
            }
          } catch (pe) {}
        }, 500);
      }
      try {
        result = await FileSystem.downloadAsync(mp4Url, tempPath);
      } finally {
        if (pollHandle) clearInterval(pollHandle);
      }
      if (onProgress) onProgress(1);
    }
    if (!result || !result.uri) throw new Error('Download failed');

    // FORMAT v3 — AES-256-CTR en flux, clé Keychain. Mémoire bornée
    // (chunks), taille fichier ≈ taille vidéo + 20 octets d'en-tête.
    //
    // Sécurité (audit 2026-08-08) : plus AUCUN fallback XOR v2 en écriture.
    // Le XOR v2 n'était pas du chiffrement (keystream répété, clé dérivable
    // du bundle JS) → un .enc v2 équivalait à du clair sur disque. Si le
    // crypto natif est indisponible (Expo Go) ou lève l'erreur Nitro
    // « unordered_map::at », on ÉCHOUE proprement le téléchargement au lieu
    // de produire un fichier v2. Le catch principal en fin de fonction
    // marque l'entrée en 'error', nettoie et rethrow → le caller
    // (downloadsCache.startDownload) affiche l'Alert « réessaie ».
    if (!DLCrypto.isAvailable()) {
      // Nettoyage du MP4 temporaire téléchargé avant d'échouer (comme les
      // autres chemins d'erreur), pour ne rien laisser sur disque.
      try { await FileSystem.deleteAsync(tempPath, { idempotent: true }); } catch (de) {}
      throw new Error('Chiffrement sécurisé indisponible sur cet appareil');
    }
    try {
      await DLCrypto.encryptFileToV3(tempPath, encPath);
    } catch (cryptoErr) {
      // Fix 2026-07-25 : vu en prod sur device — « Exception in HostFunction:
      // unordered_map::at: key not found » (buffer natif étranger côté Nitro).
      // On remonte l'erreur (après nettoyage du .enc partiel ET du temp)
      // plutôt que de retomber sur le XOR v2 : le téléchargement échoue
      // proprement et sera retenté par l'utilisateur.
      try {
        const Sentry = require('@sentry/react-native');
        Sentry.captureException(cryptoErr);
      } catch (se) {}
      try { await FileSystem.deleteAsync(encPath, { idempotent: true }); } catch (de) {}
      try { await FileSystem.deleteAsync(tempPath, { idempotent: true }); } catch (de) {}
      throw cryptoErr;
    }

    // Cleanup temp
    await FileSystem.deleteAsync(tempPath, { idempotent: true });

    // Get file size
    const encInfo = await FileSystem.getInfoAsync(encPath);

    downloads[dlKey] = { status: 'done', date: new Date().toISOString(), size: encInfo.size || 0, quality: quality || 'standard' };
    await saveDownloads(downloads);

    return true;
  } catch(e) {
    downloads[dlKey] = { status: 'error', date: new Date().toISOString(), size: 0, error: e.message };
    await saveDownloads(downloads);
    throw e;
  }
}

// NB (audit sécu 2026-08-08) : l'ancien helper `encryptV2Legacy` (écriture du
// format XOR v2) a été SUPPRIMÉ. Le XOR v2 n'était pas du chiffrement (clé
// dérivable du bundle JS) : plus aucun nouveau fichier v2 n'est écrit. La
// LECTURE des .enc v2 déjà sur disque reste supportée dans getLocalVideoUri
// (déchiffrement + migration opportuniste vers v3 à la première lecture).

// Check if a video is downloaded
async function isDownloaded(pilierKey, seanceIndex) {
  const downloads = await getDownloads();
  const dlKey = pilierKey + '_' + seanceIndex;
  if (!downloads[dlKey] || downloads[dlKey].status !== 'done') return false;
  const encPath = getEncPath(pilierKey, seanceIndex);
  const info = await FileSystem.getInfoAsync(encPath);
  return info.exists;
}

// Get local video URI (decrypt to temp file for playback).
//
// Format v2 only : `"v2|" + verification(16 hex) + "|" + hex_cipher`.
// Les fichiers v1 (XOR brut écrit en UTF-8) sont irrécupérables — l'écriture
// en UTF-8 mangeait les octets \0 / \r / etc. produits par l'XOR. On les
// auto-purge (delete .enc + clean cache + remove de la map downloads) pour
// que l'UI reflète le besoin de re-télécharger.
async function getLocalVideoUri(pilierKey, seanceIndex) {
  const encPath = getEncPath(pilierKey, seanceIndex);
  const info = await FileSystem.getInfoAsync(encPath);
  if (!info.exists) return null;

  const tempPathV3 = FileSystem.cacheDirectory + 'play_' + pilierKey + '_' + seanceIndex + '.mp4';

  // FORMAT v3 — détection binaire du magic "FBV3" (4 octets), sans charger
  // le fichier entier. Prioritaire sur les formats texte legacy.
  let isV3 = false;
  try { isV3 = DLCrypto.hasV3Magic(DLCrypto.readFirstBytes(encPath, 4)); } catch (e) {}
  if (isV3) {
    // Fichier v3 sans crypto natif (Expo Go) : illisible par design.
    if (!DLCrypto.isAvailable()) return null;
    try { await FileSystem.deleteAsync(tempPathV3, { idempotent: true }); } catch (e) {}
    // try/catch (fix 25/07) : même famille d'erreurs Nitro que l'encrypt
    // (« unordered_map::at ») — on renvoie null (l'UI propose de re-télécharger)
    // plutôt que de crasher la lecture.
    let ok = false;
    try {
      ok = await DLCrypto.decryptV3ToFile(encPath, tempPathV3);
    } catch (cryptoErr) {
      try {
        const Sentry = require('@sentry/react-native');
        Sentry.captureException(cryptoErr);
      } catch (se) {}
      ok = false;
    }
    return ok ? tempPathV3 : null;
  }

  const key = await getEncryptionKey();
  const encrypted = await FileSystem.readAsStringAsync(encPath, { encoding: FileSystem.EncodingType.UTF8 });

  // Détection v2 vs v1. v2 commence toujours par "v2|".
  if (encrypted.slice(0, 3) !== 'v2|') {
    // Format v1 (legacy broken) — purge et signale invalide.
    try { await FileSystem.deleteAsync(encPath, { idempotent: true }); } catch (e) {}
    try {
      const all = await getDownloads();
      delete all[pilierKey + '_' + seanceIndex];
      await saveDownloads(all);
    } catch (e) {}
    return null;
  }

  // Parse v2 : skip "v2|", indexOf premier '|' suivant = fin de la verification.
  const rest = encrypted.slice(3);
  const sepIdx = rest.indexOf('|');
  if (sepIdx < 0) return null;
  const verification = rest.slice(0, sepIdx);
  const hex = rest.slice(sepIdx + 1);
  if (verification !== key.substring(0, 16)) return null;

  // Hex → byte array, XOR back avec la même séquence key pour reconstruire
  // les charcodes de la string base64 originale.
  const len = hex.length >> 1;
  let base64 = '';
  for (let i = 0; i < len; i++) {
    const high = parseInt(hex.charAt(i * 2), 16);
    const low = parseInt(hex.charAt(i * 2 + 1), 16);
    if (Number.isNaN(high) || Number.isNaN(low)) return null;
    const b = ((high << 4) | low) & 0xFF;
    base64 += String.fromCharCode(b ^ key.charCodeAt(i % key.length));
  }

  // Cache invalidation : si un play_X.mp4 existe (vestige d'une ancienne
  // décryption ratée), on le purge avant d'écrire le frais.
  const tempPath = FileSystem.cacheDirectory + 'play_' + pilierKey + '_' + seanceIndex + '.mp4';
  try { await FileSystem.deleteAsync(tempPath, { idempotent: true }); } catch (e) {}
  await FileSystem.writeAsStringAsync(tempPath, base64, { encoding: FileSystem.EncodingType.Base64 });

  // Migration opportuniste v2 → v3 : maintenant qu'on a le MP4 en clair dans
  // le cache, on re-chiffre le .enc en AES (moitié moins lourd sur disque au
  // passage : v2 = hex, v3 = binaire). Échec non bloquant — au pire le
  // fichier reste en v2 et sera retenté à la prochaine lecture.
  if (DLCrypto.isAvailable()) {
    try {
      await DLCrypto.encryptFileToV3(tempPath, encPath);
      const newInfo = await FileSystem.getInfoAsync(encPath);
      const all = await getDownloads();
      const entry = all[pilierKey + '_' + seanceIndex];
      if (entry && newInfo.size) { entry.size = newInfo.size; await saveDownloads(all); }
    } catch (e) {}
  }

  return tempPath;
}

// Clean up decrypted temp file after playback
async function cleanupTempVideo(pilierKey, seanceIndex) {
  const tempPath = FileSystem.cacheDirectory + 'play_' + pilierKey + '_' + seanceIndex + '.mp4';
  await FileSystem.deleteAsync(tempPath, { idempotent: true });
}

// Sweep au démarrage (audit sécu 26/07) : supprime tous les MP4 déchiffrés
// temporaires (play_*.mp4, dl_temp_*.mp4) laissés par les lectures des
// sessions précédentes. On ne peut pas les supprimer au unmount du player
// (race avec expo-av qui lit encore le fichier), mais au boot rien n'est en
// lecture : le nettoyage est sûr. Le player recrée le fichier à la demande
// depuis le .enc. Sans ce sweep, une copie EN CLAIR de chaque vidéo premium
// lue hors-ligne restait indéfiniment dans le cache.
async function sweepTempVideos() {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return;
    const names = await FileSystem.readDirectoryAsync(dir);
    for (const n of names) {
      if (/^play_.+\.mp4$/.test(n) || /^dl_temp_.+\.mp4$/.test(n)) {
        try { await FileSystem.deleteAsync(dir + n, { idempotent: true }); } catch (e) {}
      }
    }
  } catch (e) {}
}

// Delete a downloaded video
async function deleteDownload(pilierKey, seanceIndex) {
  const encPath = getEncPath(pilierKey, seanceIndex);
  await FileSystem.deleteAsync(encPath, { idempotent: true });
  const downloads = await getDownloads();
  delete downloads[pilierKey + '_' + seanceIndex];
  await saveDownloads(downloads);
}

// Delete all downloads
async function deleteAllDownloads() {
  await FileSystem.deleteAsync(DOWNLOADS_DIR, { idempotent: true });
  await AsyncStorage.removeItem(DOWNLOADS_KEY);
}

// Get total storage used by downloads
async function getStorageUsed() {
  const downloads = await getDownloads();
  let total = 0;
  Object.values(downloads).forEach(function(d) { if (d.size) total += d.size; });
  return total;
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

export {
  downloadVideo,
  isDownloaded,
  getLocalVideoUri,
  cleanupTempVideo,
  sweepTempVideos,
  deleteDownload,
  deleteAllDownloads,
  getDownloads,
  getStorageUsed,
  formatBytes,
};
