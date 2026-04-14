import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOWNLOADS_DIR = FileSystem.documentDirectory + 'downloads/';
const DOWNLOADS_KEY = 'fluid_downloads';
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

// Convert HLS URL to MP4 download URL
function hlsToMp4(url) {
  if (!url) return null;
  return url.replace(/\/playlist\.m3u8$/, '/play_720p.mp4');
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

// Download and encrypt a video
// Returns a callback to track progress: onProgress(progress 0-1)
async function downloadVideo(pilierKey, seanceIndex, videoUrl, onProgress) {
  await ensureDir();
  const mp4Url = hlsToMp4(videoUrl);
  if (!mp4Url) throw new Error('Invalid video URL');

  const downloads = await getDownloads();
  const dlKey = pilierKey + '_' + seanceIndex;
  downloads[dlKey] = { status: 'downloading', date: new Date().toISOString(), size: 0 };
  await saveDownloads(downloads);

  try {
    const tempPath = FileSystem.cacheDirectory + 'dl_temp_' + dlKey + '.mp4';
    const encPath = getEncPath(pilierKey, seanceIndex);

    // Download with progress
    const downloadResumable = FileSystem.createDownloadResumable(
      mp4Url, tempPath, {},
      function(downloadProgress) {
        if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
          onProgress(downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) throw new Error('Download failed');

    // Read file as base64, encrypt, write
    const key = await getEncryptionKey();
    const base64 = await FileSystem.readAsStringAsync(tempPath, { encoding: FileSystem.EncodingType.Base64 });

    // Simple encryption: prepend key hash to verify on decrypt, XOR the base64 string
    const verification = key.substring(0, 16);
    const encrypted = verification + '|' + base64.split('').map(function(c, i) {
      return String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length));
    }).join('');

    await FileSystem.writeAsStringAsync(encPath, encrypted, { encoding: FileSystem.EncodingType.UTF8 });

    // Cleanup temp
    await FileSystem.deleteAsync(tempPath, { idempotent: true });

    // Get file size
    const encInfo = await FileSystem.getInfoAsync(encPath);

    downloads[dlKey] = { status: 'done', date: new Date().toISOString(), size: encInfo.size || 0 };
    await saveDownloads(downloads);

    return true;
  } catch(e) {
    downloads[dlKey] = { status: 'error', date: new Date().toISOString(), size: 0, error: e.message };
    await saveDownloads(downloads);
    throw e;
  }
}

// Check if a video is downloaded
async function isDownloaded(pilierKey, seanceIndex) {
  const downloads = await getDownloads();
  const dlKey = pilierKey + '_' + seanceIndex;
  if (!downloads[dlKey] || downloads[dlKey].status !== 'done') return false;
  const encPath = getEncPath(pilierKey, seanceIndex);
  const info = await FileSystem.getInfoAsync(encPath);
  return info.exists;
}

// Get local video URI (decrypt to temp file for playback)
async function getLocalVideoUri(pilierKey, seanceIndex) {
  const encPath = getEncPath(pilierKey, seanceIndex);
  const info = await FileSystem.getInfoAsync(encPath);
  if (!info.exists) return null;

  const key = await getEncryptionKey();
  const encrypted = await FileSystem.readAsStringAsync(encPath, { encoding: FileSystem.EncodingType.UTF8 });

  // Verify key
  const parts = encrypted.split('|');
  if (parts.length < 2 || parts[0] !== key.substring(0, 16)) return null;

  // Decrypt
  const decrypted = parts[1].split('').map(function(c, i) {
    return String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length));
  }).join('');

  // Write decrypted temp file
  const tempPath = FileSystem.cacheDirectory + 'play_' + pilierKey + '_' + seanceIndex + '.mp4';
  await FileSystem.writeAsStringAsync(tempPath, decrypted, { encoding: FileSystem.EncodingType.Base64 });

  return tempPath;
}

// Clean up decrypted temp file after playback
async function cleanupTempVideo(pilierKey, seanceIndex) {
  const tempPath = FileSystem.cacheDirectory + 'play_' + pilierKey + '_' + seanceIndex + '.mp4';
  await FileSystem.deleteAsync(tempPath, { idempotent: true });
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
  var total = 0;
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
  deleteDownload,
  deleteAllDownloads,
  getDownloads,
  getStorageUsed,
  formatBytes,
  hlsToMp4,
};
