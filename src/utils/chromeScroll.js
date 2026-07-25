// chromeScroll — masquage coordonné des menus (header + barre d'onglets)
// pendant le scroll (demande Yvan 24/07 : "faire disparaître les menus du
// haut et du bas quand on scroll").
//
// Principe : une Animated.Value singleton `chromeAnim` (1 = menus visibles,
// 0 = masqués) que chaque écran scrollable pilote via un handler onScroll,
// et que les chromes (CustomTabBar dans App.js, header MonCorps) consomment
// en translateY interpolé — tout en native driver, zéro re-render React.
//
// Règles de feel (standard iOS) :
// - on masque après ~24 pt de scroll VERS LE BAS cumulés (seuil anti-jitter) ;
// - on ré-affiche dès ~12 pt vers le haut (retour plus réactif que l'aller) ;
// - toujours visible près du sommet (< 64 pt) et pendant l'overscroll bounce ;
// - `showChrome()` force le retour (changement d'onglet, ouverture de modal).
//
// Chaque écran crée SON handler via createChromeScrollHandler() (lastY local :
// deux ScrollViews qui partagent un même lastY sauteraient au changement
// d'écran), mais tous pilotent la même chromeAnim.

import { Animated, Easing } from 'react-native';

export const chromeAnim = new Animated.Value(1);

// Réglages feel (retour Yvan 24/07 : "trop nerveux, laisse un peu scroller,
// fais disparaître en douceur") : on laisse ~70 pt de scroll avant de masquer,
// et la sortie est plus lente que le retour.
const HIDE_AFTER = 70;   // pt cumulés vers le bas avant masquage
const SHOW_AFTER = 14;   // pt cumulés vers le haut avant ré-affichage
const TOP_SAFE = 64;     // sous ce contentOffset.y, chrome toujours visible
const HIDE_MS = 380;     // sortie en douceur
const SHOW_MS = 260;     // retour un peu plus vif (on cherche les menus)

let chromeVisible = true;
let running = null;

function animateTo(toValue) {
  if (running) running.stop();
  running = Animated.timing(chromeAnim, {
    toValue: toValue,
    duration: toValue === 0 ? HIDE_MS : SHOW_MS,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    useNativeDriver: true,
  });
  running.start(function() { running = null; });
}

export function showChrome() {
  if (chromeVisible) return;
  chromeVisible = true;
  animateTo(1);
}

export function hideChrome() {
  if (!chromeVisible) return;
  chromeVisible = false;
  animateTo(0);
}

// Fabrique un onScroll à brancher tel quel :
//   <ScrollView onScroll={createChromeScrollHandler()} scrollEventThrottle={16}>
// (mémoïser côté écran : useRef(createChromeScrollHandler()).current)
export function createChromeScrollHandler() {
  let lastY = 0;
  let acc = 0;
  return function(e) {
    try {
      const y = e.nativeEvent.contentOffset.y;
      if (y <= 0) { lastY = 0; acc = 0; showChrome(); return; } // bounce haut
      const delta = y - lastY;
      lastY = y;
      // Overscroll bounce bas : contentOffset dépasse la fin du contenu,
      // les deltas y sont du ressort, pas une intention — on ignore.
      const max = e.nativeEvent.contentSize.height - e.nativeEvent.layoutMeasurement.height;
      if (max > 0 && y > max) return;
      acc = (delta > 0) === (acc > 0) ? acc + delta : delta;
      if (y < TOP_SAFE) { showChrome(); return; }
      if (acc > HIDE_AFTER) hideChrome();
      else if (acc < -SHOW_AFTER) showChrome();
    } catch (err) { /* jamais bloquant pour le scroll */ }
  };
}
