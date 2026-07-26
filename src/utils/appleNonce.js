// Nonce anti-rejeu pour Sign in with Apple (audit sécu 26/07).
//
// Flux standard Apple/Supabase :
//   1. nonce aléatoire (32 octets hex) ;
//   2. son SHA-256 part à Apple dans signInAsync({ nonce }) — Apple
//      l'embarque dans l'identity token signé ;
//   3. le nonce BRUT part à Supabase dans signInWithIdToken({ nonce }) —
//      Supabase hashe et compare avec celui du token.
// Un identity token intercepté ne peut donc plus être rejoué sans le nonce.
//
// Repli : si expo-crypto est indisponible ou échoue, on retourne null et
// les call sites continuent SANS nonce (comportement historique). La
// connexion ne doit jamais casser pour une amélioration de sécurité.

let Crypto = null;
try { Crypto = require('expo-crypto'); } catch (e) {}

export async function makeAppleNonce() {
  if (!Crypto) return null;
  try {
    const bytes = await Crypto.getRandomBytesAsync(32);
    const raw = Array.from(bytes)
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
    const hashed = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      raw
    );
    return { raw: raw, hashed: hashed };
  } catch (e) {
    return null;
  }
}
