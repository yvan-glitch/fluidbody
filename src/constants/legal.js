// Legal URLs surfaced in the UI (paywall, signup acceptance, profile).
// Sourced from app.json → expo.extra.legal at runtime so they can be
// updated via OTA without a native rebuild. Hardcoded fallback below
// matches the values in app.json — used in case expo-constants isn't
// available (e.g. very early in Expo Go boot).

let Constants = null;
try { Constants = require('expo-constants').default || require('expo-constants'); } catch (e) {}

const FALLBACK = {
  privacyUrl: 'https://yvan-glitch.github.io/fluidbody-privacy/',
  termsUrl: 'https://yvan-glitch.github.io/fluidbody-privacy/terms/',
  termsUrlEn: 'https://yvan-glitch.github.io/fluidbody-privacy/terms/en/',
  termsVersion: '1.0',
};

function readExtra() {
  try {
    const cfg = Constants && (Constants.expoConfig || Constants.manifest || Constants.manifest2);
    const extra = cfg && cfg.extra;
    if (extra && extra.legal) return extra.legal;
  } catch (e) {}
  return null;
}

export const LEGAL = { ...FALLBACK, ...(readExtra() || {}) };

// Pick the right Terms URL for a given lang (fr/en/es/it → EN for non-FR).
export function getTermsUrl(lang) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  return isFr ? LEGAL.termsUrl : LEGAL.termsUrlEn;
}

// AsyncStorage key for the "ToS accepted" flag — bumped on each major
// terms revision so users have to re-accept after a substantive update.
export const TERMS_ACCEPTED_STORAGE_KEY = 'fluid_terms_accepted_v1';
