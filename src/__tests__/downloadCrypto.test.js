// Tests du format v3 (parties pures — le chiffrement natif est couvert par
// un test manuel sur device, quick-crypto n'existant pas sous jest).
import { hasV3Magic, isAvailable, V3_HEADER_LENGTH } from '../utils/downloadCrypto';

describe('downloadCrypto (format v3)', () => {
  test('hasV3Magic reconnaît le magic FBV3', () => {
    expect(hasV3Magic(new Uint8Array([0x46, 0x42, 0x56, 0x33]))).toBe(true);
    expect(hasV3Magic(new Uint8Array([0x46, 0x42, 0x56, 0x33, 0xaa, 0xbb]))).toBe(true);
  });

  test('hasV3Magic rejette les autres contenus', () => {
    // "v2|c" — début d'un fichier v2 legacy (texte)
    expect(hasV3Magic(new Uint8Array([0x76, 0x32, 0x7c, 0x63]))).toBe(false);
    expect(hasV3Magic(new Uint8Array([0x46, 0x42, 0x56]))).toBe(false); // trop court
    expect(hasV3Magic(new Uint8Array(0))).toBe(false);
    expect(hasV3Magic(null)).toBe(false);
    expect(hasV3Magic(undefined)).toBe(false);
  });

  test('en-tête v3 = magic (4) + IV (16)', () => {
    expect(V3_HEADER_LENGTH).toBe(20);
  });

  test('isAvailable est false sous jest (pas de module natif) et memoïsé', () => {
    expect(isAvailable()).toBe(false);
    expect(isAvailable()).toBe(false);
  });
});
