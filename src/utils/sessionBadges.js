// sessionBadges — détermine un badge (Nouveau / Programme / Favori /
// Reprendre) à afficher en top-left d'une card de séance.
//
// Stratégie : la card appelle `pickBadge(ctx)` avec les flags qu'elle
// connaît (favoris, resume, programme actif, séance flaggée new), et
// récupère soit `null` soit `{ label, tone }`. La priorité hardcodée
// est : Reprendre > Nouveau > Programme > Favori — calquée sur
// l'attention visuelle qu'on veut générer.
//
// `tone` : 'lime' | 'gold' | 'coral' | 'white'. Le mapping visuel
// (couleur de fond, bordure, texte) vit dans <SessionBadge />.

import { isFavoriteCached } from './favorites';

export const BADGE_TONES = {
  lime:  { fg: '#AEEF4D', border: 'rgba(174,239,77,0.65)', tint: 'rgba(174,239,77,0.16)' },
  gold:  { fg: '#FFD27A', border: 'rgba(255,210,122,0.65)', tint: 'rgba(255,210,122,0.16)' },
  coral: { fg: '#FF8A5C', border: 'rgba(255,138,92,0.65)', tint: 'rgba(255,138,92,0.16)' },
  white: { fg: '#FFFFFF', border: 'rgba(255,255,255,0.55)', tint: 'rgba(255,255,255,0.12)' },
};

// Séances marquées manuellement "nouvelles" — à ajuster quand on
// publie de nouveaux contenus. Format : "pilierKey_seanceIndex".
// Note : on n'a pas d'`addedAt` sur les seances tuples ; cette liste
// remplit le rôle en attendant.
export const MANUAL_NEW_SESSIONS = new Set([
  'p2_0', // "Le dos expliqué" — déjà publié (premier contenu live)
  'p2_1', // "Pourquoi le dos souffre"
  'p3_0', // "Comprendre la hanche"
  // À étendre quand de nouveaux contenus arrivent. Une fois qu'une
  // séance n'est plus "nouvelle" (30 jours en pratique), la retirer
  // d'ici. À terme, remplacer par un champ `addedAt` dans data.js.
]);

// Séances marquées "appartenant à un programme thématique" — corresponds
// aux clés citées dans THEMES de ProgrammesTV (Réveil/Dos/Posttravail/
// Core/Souplesse). À l'heure actuelle on flag par pilier ; quand on aura
// une structure programme→séance dans les données on basculera ici.
export const PROGRAM_PILIER_KEYS = new Set(['p4', 'p2', 'p1', 'p7', 'p3']);

const LABELS = {
  resume:  { fr: 'REPRENDRE', en: 'RESUME' },
  newer:   { fr: 'NOUVEAU',   en: 'NEW' },
  program: { fr: 'PROGRAMME', en: 'PROGRAM' },
  favorite:{ fr: 'FAVORI',    en: 'FAVORITE' },
};

function lbl(kind, lang) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  return isFr ? LABELS[kind].fr : LABELS[kind].en;
}

// Renvoie { label, tone } ou null. Tous les flags sont optionnels et
// peuvent venir de différentes sources :
// - `sessionId` : "<pilierKey>_<idx>" — pour cross-référence favoris.
// - `pilierKey` : pour PROGRAM_PILIER_KEYS.
// - `isResume` : true si l'utilisateur a une position sauvegardée
//   pour cette séance (resume token non terminé).
// - `isNew`, `isFavorite` : peuvent être passés directement, sinon
//   on les déduit (`sessionId` ∈ MANUAL_NEW_SESSIONS, favorite cache).
// - `lang` : pour la traduction du label.
export function pickBadge(ctx) {
  if (!ctx) return null;
  const lang = ctx.lang || 'fr';
  const sid  = ctx.sessionId || (ctx.pilierKey && typeof ctx.idx === 'number' ? ctx.pilierKey + '_' + ctx.idx : null);

  const isResume   = !!ctx.isResume;
  const isNew      = ctx.isNew != null ? !!ctx.isNew : (sid ? MANUAL_NEW_SESSIONS.has(sid) : false);
  const isProgram  = ctx.isProgram != null ? !!ctx.isProgram : (!!ctx.pilierKey && PROGRAM_PILIER_KEYS.has(ctx.pilierKey));
  const isFavorite = ctx.isFavorite != null ? !!ctx.isFavorite : (sid ? isFavoriteCached(sid) : false);

  // Priorité : Reprendre (action immédiate) > Nouveau (découverte) >
  // Programme (contexte de série) > Favori (signal personnel).
  if (isResume)   return { label: lbl('resume', lang),   tone: 'coral' };
  if (isNew)      return { label: lbl('newer', lang),    tone: 'lime'  };
  if (isProgram)  return { label: lbl('program', lang),  tone: 'gold'  };
  if (isFavorite) return { label: lbl('favorite', lang), tone: 'white' };
  return null;
}
