// IAP — stratégie de pricing 3 phases pour Fluidbody+.
//
// Phase 1 "founder" : tarif fondateur servi aujourd'hui. Réservé aux
//   premiers membres ; économie ~50% vs. tarif standard cible.
// Phase 2 "intermediate" : à activer plus tard (~6 mois) via un offering
//   RevenueCat dédié, sans toucher au code.
// Phase 3 "standard" : tarif final affiché en référence (prix barrés sur le
//   paywall actuel, pour matérialiser l'économie).
//
// Les IDs ci-dessous correspondent à ce qu'on souhaite voir dans App Store
// Connect une fois les nouveaux produits créés. Pour l'instant les produits
// LIVE en production sont ceux de `LEGACY_PRODUCT_IDS` (mappés sur la phase
// founder via `PRODUCT_ID_TO_PHASE`). Le paywall iPhone continue de
// récupérer ses RC packages via ces IDs legacy ; on changera après la
// publication des nouveaux produits.

export const IAP_PRODUCTS = {
  founder: {
    monthly: 'fluidbody_pro_monthly_founder',
    yearly:  'fluidbody_pro_yearly_founder',
    prices:  { monthly: 12.90, yearly: 99, currency: 'CHF' },
    // Ratio = (1 - (yearly / (monthly * 12))) * 100 — % économie annuel vs
    // mensuel ×12. Pour 12.90/mois et 99/an : 36%.
    ratioMonthlyYearly: 36,
  },
  intermediate: {
    monthly: 'fluidbody_pro_monthly_v2',
    yearly:  'fluidbody_pro_yearly_v2',
    prices:  { monthly: 17.90, yearly: 149, currency: 'CHF' },
    ratioMonthlyYearly: 31,
  },
  standard: {
    monthly: 'fluidbody_pro_monthly_standard',
    yearly:  'fluidbody_pro_yearly_standard',
    prices:  { monthly: 24.90, yearly: 199, currency: 'CHF' },
    ratioMonthlyYearly: 33,
  },
};

// Produits LIVE actuels dans App Store Connect / RevenueCat — utilisés tant
// que les nouveaux IDs ne sont pas créés. Le PaywallModal lookup se fait
// toujours via ces clés.
export const LEGACY_PRODUCT_IDS = {
  monthly: 'com.fluidbody.app.premium.monthly',
  yearly:  'com.fluidbody.app.premium.yearly',
};

// Mapping productID → phase. Permet au paywall de déduire si on doit
// afficher le bandeau "Prix Fondateur" (et calculer l'économie vs. standard)
// quel que soit le set de produits servi par RC.
export const PRODUCT_ID_TO_PHASE = {
  [LEGACY_PRODUCT_IDS.monthly]: 'founder',
  [LEGACY_PRODUCT_IDS.yearly]:  'founder',
  [IAP_PRODUCTS.founder.monthly]:      'founder',
  [IAP_PRODUCTS.founder.yearly]:       'founder',
  [IAP_PRODUCTS.intermediate.monthly]: 'intermediate',
  [IAP_PRODUCTS.intermediate.yearly]:  'intermediate',
  [IAP_PRODUCTS.standard.monthly]:     'standard',
  [IAP_PRODUCTS.standard.yearly]:      'standard',
};

// Source de vérité pour les prix de référence et les économies fondateur.
export const STANDARD_PRICES = IAP_PRODUCTS.standard.prices;
export const FOUNDER_PRICES  = IAP_PRODUCTS.founder.prices;

// Économies founder vs standard — calculées une fois au chargement du
// module, pas par tick de render.
export const FOUNDER_SAVINGS = {
  // % éco mensuel (12.90 vs 24.90 = 48%)
  monthlyVsStandardPct: Math.round(
    ((STANDARD_PRICES.monthly - FOUNDER_PRICES.monthly) / STANDARD_PRICES.monthly) * 100
  ),
  // % éco annuel (99 vs 199 = 50%)
  yearlyVsStandardPct: Math.round(
    ((STANDARD_PRICES.yearly - FOUNDER_PRICES.yearly) / STANDARD_PRICES.yearly) * 100
  ),
  // Économie annuelle absolue (CHF/an) si l'utilisateur prend l'annuel
  // founder plutôt que de payer 12 × le mensuel standard. Pour 24.90×12 −
  // 99 = 199.80 CHF.
  annualVsMonthlyStandardCHF: Math.round(
    (STANDARD_PRICES.monthly * 12) - FOUNDER_PRICES.yearly
  ),
  // Économie annuelle absolue founder yearly vs standard yearly (199 − 99
  // = 100 CHF).
  annualYearlyCHF: STANDARD_PRICES.yearly - FOUNDER_PRICES.yearly,
};

// Format helper — accepte (amount, lang). Pas de devise dynamique car on
// est aujourd'hui mono-marché CHF (Suisse). `Intl.NumberFormat` choisit le
// séparateur décimal selon la locale (fr-CH → "12.90", en-US → "12.90").
export function formatPriceCHF(amount, lang) {
  const locale =
    lang === 'fr' ? 'fr-CH' :
    lang === 'es' ? 'es-ES' :
    lang === 'it' ? 'it-IT' :
    'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (e) {
    // Fallback simple si Intl n'est pas dispo (Hermes ancien).
    return 'CHF ' + (Number.isInteger(amount) ? amount : amount.toFixed(2));
  }
}

// Helper : à partir d'un productId RC, retourne la phase + prix associés.
export function getPhaseFromProductId(productId) {
  if (!productId) return null;
  const phase = PRODUCT_ID_TO_PHASE[productId];
  if (!phase) return null;
  return { phase: phase, ...IAP_PRODUCTS[phase] };
}

// Cap soft pour la mention "tarif limité aux 500 premiers membres". Yvan
// confirme/ajuste avant de l'afficher.
export const FOUNDER_MEMBER_CAP = 500;
