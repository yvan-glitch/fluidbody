// Patch postinstall : react-native-quick-base64 (dépendance de
// react-native-quick-crypto) ne déclare que :ios dans son podspec, ce qui
// fait échouer `pod install` pour la cible tvOS (build EAS production-tv).
// La lib est du pur JSI/C++ sans API spécifique iPhone — elle compile très
// bien pour tvOS, il suffit de le déclarer. Idempotent, no-op si le podspec
// change de forme (on loggue au lieu de casser l'install).
const fs = require('fs');
const path = require('path');

const podspec = path.join(
  __dirname, '..', 'node_modules', 'react-native-quick-base64', 'react-native-quick-base64.podspec'
);

try {
  let src = fs.readFileSync(podspec, 'utf8');
  if (src.includes(':tvos')) {
    console.log('[patch-quick-base64-tvos] déjà patché, rien à faire.');
    process.exit(0);
  }
  const before = 's.platforms    = { :ios => min_ios_version_supported }';
  const after = 's.platforms    = { :ios => min_ios_version_supported, :tvos => "13.4" }';
  if (!src.includes(before)) {
    console.warn('[patch-quick-base64-tvos] ligne platforms introuvable — podspec modifié upstream ? Patch ignoré.');
    process.exit(0);
  }
  src = src.replace(before, after);
  fs.writeFileSync(podspec, src);
  console.log('[patch-quick-base64-tvos] podspec patché pour tvOS.');
} catch (e) {
  console.warn('[patch-quick-base64-tvos] échec (non bloquant) :', e.message);
}
