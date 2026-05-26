// tvImagePool — les séances n'ont pas d'image propre dans la data ([titre,
// durée, étape, hasVideo]). Sur grand écran TV, répéter l'image du pilier
// sur chaque card d'un même pilier donne un mur de photos identiques (criard
// sur 65"). On varie donc visuellement via une rotation déterministe sur un
// pool de toutes les images de contenu disponibles (piliers + programmes).
//
// `pickSessionImage(pilierKey, idx)` : déterministe (stable au re-render) et
// sans répétition adjacente — l'offset séquentiel sur `idx` garantit que des
// cards voisines reçoivent des images différentes (pool > taille des rangées).
//
// TV-only — zéro impact iPhone.

import { PILIER_IMAGES } from '../../constants/data';

// 17 photos studio Sabrina (Espace Pilates Suisse) — exportées aussi pour
// servir de hero / backdrop ailleurs.
export const SABRINA_IMAGES = [
  require('../../../assets/coach/sabrina_1.jpg'),
  require('../../../assets/coach/sabrina_2.jpg'),
  require('../../../assets/coach/sabrina_3.jpg'),
  require('../../../assets/coach/sabrina_4.jpg'),
  require('../../../assets/coach/sabrina_5.jpg'),
  require('../../../assets/coach/sabrina_6.jpg'),
  require('../../../assets/coach/sabrina_7.jpg'),
  require('../../../assets/coach/sabrina_8.jpg'),
  require('../../../assets/coach/sabrina_9.jpg'),
  require('../../../assets/coach/sabrina_10.jpg'),
  require('../../../assets/coach/sabrina_11.jpg'),
  require('../../../assets/coach/sabrina_12.jpg'),
  require('../../../assets/coach/sabrina_13.jpg'),
  require('../../../assets/coach/sabrina_14.jpg'),
  require('../../../assets/coach/sabrina_15.jpg'),
  require('../../../assets/coach/sabrina_16.jpg'),
  require('../../../assets/coach/sabrina_17.jpg'),
];

const POOL = [
  PILIER_IMAGES.p1, PILIER_IMAGES.p3, PILIER_IMAGES.p4, PILIER_IMAGES.p6, PILIER_IMAGES.p5,
  PILIER_IMAGES.p2, PILIER_IMAGES.p7, PILIER_IMAGES.p8, PILIER_IMAGES.p9, PILIER_IMAGES.sdj,
  require('../../../assets/programs/reveil-matinal.jpg'),
  require('../../../assets/programs/mal-de-dos.jpg'),
  require('../../../assets/programs/post-travail.jpg'),
  require('../../../assets/programs/core-plancher.jpg'),
  require('../../../assets/programs/souplesse.jpg'),
  require('../../../assets/programs/vitaly-gariev-7C_Ri-7kyXc-unsplash.jpg'),
].concat(SABRINA_IMAGES).filter(Boolean);

function hashStr(s) {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}

export function pickSessionImage(pilierKey, idx) {
  if (POOL.length === 0) return PILIER_IMAGES[pilierKey];
  const base = hashStr(pilierKey);
  return POOL[(base + (idx || 0)) % POOL.length];
}

export { POOL as TV_IMAGE_POOL };
