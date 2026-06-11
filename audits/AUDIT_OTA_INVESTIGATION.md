# Audit OTA — pourquoi les updates expo-updates ne se pull pas sur build #93

**Date** : 2026-06-04
**Cible** : iPhone 17 Pro Max, iOS 26, TestFlight build #93 Fluidbody
**Symptôme** : aucun OTA appliqué malgré multiples cold starts, désinstallation + réinstallation, Wi-Fi sain. Ni `2e3ad6dc` (test "rouge Développeur") ni `28bde019` (fix Sabrina) ne sont visibles.

---

## 1. État config actuel (faits, sans interprétation)

### Fichiers inspectés

| Source | Clé | Valeur |
|---|---|---|
| `app.json` | `expo.updates.url` | `https://u.expo.dev/c94beda1-885e-48cd-83ca-2a1e2f10da79` |
| `app.json` | `expo.runtimeVersion.policy` | `appVersion` |
| `app.json` | `expo.version` | `1.0.0` |
| `app.json` | `expo.updates.codeSigning*` | **absent** (pas de signing) |
| `app.json` | `expo.updates.fallbackToCacheTimeout` | **absent** (= défaut `0`) |
| `app.json` | `expo.updates.checkAutomatically` | **absent** (= défaut `ON_LOAD`) |
| `app.json` ATS | `NSAllowsArbitraryLoads` | `false` |
| `app.json` ATS | exceptions | `b-cdn.net`, `supabase.co` uniquement |
| `eas.json` | `build.production.channel` | `production` |
| `eas.json` | `build.production.appVersionSource` | `remote` (via cli config) |
| `ios/.../Expo.plist` | `EXUpdatesEnabled` | `true` |
| `ios/.../Expo.plist` | `EXUpdatesCheckOnLaunch` | `ALWAYS` |
| `ios/.../Expo.plist` | `EXUpdatesLaunchWaitMs` | `0` |
| `ios/.../Expo.plist` | `EXUpdatesRuntimeVersion` | `1.0.0` |
| `ios/.../Expo.plist` | `EXUpdatesURL` | identique à app.json |
| `ios/.../Expo.plist` | `EXUpdatesRequestHeaders` | **absent en local** (injecté par EAS au build) |
| `package.json` | `expo-updates` | `~29.0.17` (en lockfile : `29.0.17`) |
| `app.config.js` | override prod (non-TV) | identité, **n'altère pas la config OTA** |

### Code OTA app-side

`src/components/OtaUpdateBanner.js` — **seul consommateur** de l'API `expo-updates`. App.js n'appelle JAMAIS `Updates.checkForUpdateAsync` / `fetchUpdateAsync` / `reloadAsync` directement.

Gate critique du banner (l. 67) :
```js
const enabled = Updates && !__DEV__ && Updates.channel;
```

`Updates.channel` est calculé natif → JS (`AppController.swift:79`) :
```swift
"channel": requestHeaders["expo-channel-name"] ?? ""
```

Si le header n'est pas injecté ou est vide → `Updates.channel === ""` → `enabled` falsy → **le banner ne checke jamais d'update**.

Catch silencieux (l. 85-88) :
```js
} catch (e) {
  // Network error, server down, etc. Silent fail — banner just doesn't show.
  // Don't log in prod, would spam Sentry on every spotty network.
}
```
→ **aucune trace Sentry** si la requête `u.expo.dev` fail ou returne une erreur.

### Channel/branch mapping

- Script `scripts/push-update.sh` publie sur `--branch production`.
- Build profile prod a `"channel": "production"`.
- Mapping `channel=production` → `branch=production` doit exister côté EAS dashboard. **Non vérifiable depuis cet audit** (pas d'auth EAS dans le sandbox).

### Note importante sur le comportement natif

`EXUpdatesLaunchWaitMs = 0` + `EXUpdatesCheckOnLaunch = ALWAYS` =
> au cold start, l'app lance le bundle embedded **immédiatement**, puis lance un fetch d'update **en arrière-plan**. Si une update est trouvée, elle est **téléchargée et armée pour le PROCHAIN cold start**, pas appliquée au boot courant.

Donc même si tout marche, Yvan a besoin de **2 cold starts** pour voir un OTA : un pour télécharger, un pour appliquer.

---

## 2. Top 3 hypothèses les plus probables

### Hypothèse #1 — `Updates.channel` vide → channel mapping cassé côté EAS *(plus probable)*

**Preuves** :
- Plist local n'a pas `EXUpdatesRequestHeaders` (normal : EAS injecte au build).
- Si EAS n'a PAS injecté l'header `expo-channel-name=production` dans le build #93 (bug EAS, mauvais profile, channel renommé, mapping cassé), le client envoie une requête `u.expo.dev` SANS header de channel.
- Sans channel header, le serveur EAS Update ne sait pas quelle branch servir → no-update ou 404.
- **La gate `Updates.channel` du banner désactive aussi tout side-effect UI**, ce qui rend le bug invisible.
- Cohérent avec : "OTAs sur branch production avec runtime 1.0.0 → match parfait" mais quand même rien.

**Comment discriminer** :
```bash
# Sur Mac d'Yvan, avec EAS auth :
cd /Users/xvan06/fluidbody
eas build:list --limit 3 --platform ios --json | python3 -m json.tool | grep -i channel
```
Vérifier que le build #93 a bien `"channel": "production"` (pas `null`, pas `""`, pas `preview`).

Si possible : **ouvrir l'IPA #93 dans Xcode** (ou télécharger l'IPA depuis App Store Connect → unzipper → `Payload/FluidBody.app/Expo.plist`) et confirmer que `EXUpdatesRequestHeaders.expo-channel-name = "production"` est bien présent.

### Hypothèse #2 — Comportement "1 cold start de retard" mal interprété *(probable, peut s'ajouter à #1)*

**Preuves** :
- `EXUpdatesLaunchWaitMs = 0` confirme : embedded lancé immédiatement, fetch en background, applied au prochain boot.
- Yvan dit "multiples cold starts" sans préciser entre chacun s'il a attendu la fin du download (asset images peuvent être lourdes).
- Désinstallation + réinstallation **remet le compteur à zéro** : la première install relance avec le bundle embedded, le 1er cold start armé le fetch, le **2e cold start** applique l'OTA — pas la première relance après install.

**Comment discriminer** :
Pendant un cold start, laisser l'app ouverte 30-60s avec data on (pour que le fetch background termine), kill via app switcher, re-cold start. **Si l'OTA arrive à ce 2e boot → c'est juste un timing**. Si toujours rien → c'est pas ça.

### Hypothèse #3 — Network/ATS bloque `u.expo.dev` silencieusement *(possible mais moins probable)*

**Preuves côté contre** : ATS dans `app.json` autorise toutes les requêtes HTTPS (NSAllowsArbitraryLoads = false signifie HTTPS-only, mais `u.expo.dev` est HTTPS → autorisé sans exception nécessaire). Pas de blocage explicite.

**Preuves côté pour** :
- ISP suisse, DNS récursifs parfois quirky (cf. memory : *"DNS de l'ISP d'Yvan peut bloquer u.expo.dev"*).
- iOS 26 a un Private Relay / Network Quality Index plus strict — possible filtrage non documenté.
- Aucun Sentry log = silent fail dans le banner OU le natif checkForUpdate (qui logge via `os_log` mais pas Sentry).

**Comment discriminer** :
Sur le Mac d'Yvan (même réseau que l'iPhone) :
```bash
nslookup u.expo.dev
curl -I -H "expo-channel-name: production" -H "expo-runtime-version: 1.0.0" -H "expo-platform: ios" -H "expo-protocol-version: 1" -H "expo-api-version: 1" -H "expo-expect-signature: false" -H "Accept: multipart/mixed,application/expo+json,application/json" https://u.expo.dev/c94beda1-885e-48cd-83ca-2a1e2f10da79
```
Status 200 + body multipart = serveur joignable, update existe. 4xx = config server-side. Timeout / DNS error = blocage réseau.

---

## 3. Hypothèses moins probables (écartées, pour mémoire)

| # | Hypothèse | Verdict | Pourquoi |
|---|---|---|---|
| 4 | Code signing certificate mismatch | **Écartée** | `app.json` n'a pas de `codeSigningCertificate` → signing désactivé, donc pas de check à fail. |
| 5 | CDN cache stale | **Improbable** | EAS Update sert un manifest dynamique calculé par requête, pas un asset statique. |
| 6 | Bug iOS 26 spécifique expo-updates 29.0.17 | **Très improbable** | Changelog 29.0.x ne mentionne pas iOS 26. Aucune release note récente Expo sur ce thème. |
| 7 | Bundle JS désactive Updates via condition | **Écartée** | Pas de `Updates.disable` ou flag KILL dans App.js. Seul gate JS = `OtaUpdateBanner.js` qui touche uniquement l'UI, pas le fetch natif. |
| 8 | Anti-bricking measures déclenchées | **Improbable** | `EXUpdatesDisableAntiBrickingMeasures` n'est pas set, mais l'anti-brick ne bloque que si un update download crashe au boot → on aurait des traces Sentry. |

---

## 4. Tests/diagnostics recommandés (par ordre de coût)

### Test A (gratuit, 2 min) — Vérifier le channel embedded dans l'IPA #93
1. Télécharger l'IPA #93 depuis EAS dashboard ou App Store Connect.
2. `unzip Payload.../FluidBody.app/Expo.plist`.
3. `plutil -p Expo.plist | grep -A 5 RequestHeaders`.
4. Confirmer `expo-channel-name = production`. **Si absent ou différent → hypothèse #1 validée**.

### Test B (gratuit, 1 min) — Vérifier channel mapping côté EAS
```bash
eas channel:view production --json
```
Champs à vérifier : `branchMapping` contient bien `production` (la branche).

### Test C (gratuit, 5 min) — Simuler l'update request avec curl
Voir hypothèse #3 ci-dessus. Si curl retourne le manifest → côté serveur OK, problème côté client.

### Test D (gratuit, 5 min) — Test de timing "2 boots"
Cold start, attendre 60s data on, kill via app switcher, re-cold start. Si l'OTA apparaît au 2e boot → c'était juste le délai. **Discrimine hypothèse #2 vs #1/#3**.

### Test E (faible coût, 10 min) — Patcher temporairement `OtaUpdateBanner.js` avec verbose Sentry logging
Cf. patches section 5.

---

## 5. Patches potentiels (PAS appliqués — pour discussion)

### Patch P1 — Verbose logging Sentry sur chaque step d'update *(coût: faible, risque: aucun)*

Modifier `OtaUpdateBanner.js#checkForUpdate` :

```js
const checkForUpdate = async () => {
  if (!Updates || __DEV__) return;
  // Ne PLUS gate sur Updates.channel — on veut savoir POURQUOI il est vide.
  try {
    sentryCapture(new Error('OTA_DEBUG_START'), {
      channel: Updates.channel,
      runtimeVersion: Updates.runtimeVersion,
      updateId: Updates.updateId,
      isEnabled: Updates.isEnabled,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    });
    const result = await Updates.checkForUpdateAsync();
    sentryCapture(new Error('OTA_DEBUG_CHECK_OK'), {
      isAvailable: result?.isAvailable,
      manifest: result?.manifest ? 'present' : 'null',
    });
    if (!result?.isAvailable) return;
    const fetched = await Updates.fetchUpdateAsync();
    sentryCapture(new Error('OTA_DEBUG_FETCH_OK'), {
      isNew: fetched?.isNew,
    });
    if (fetched?.isNew) setVisible(true);
  } catch (e) {
    sentryCapture(e, { stage: 'OTA_DEBUG_FAIL' });
  }
};
```

**Trade-off** : pollue Sentry avec des events INFO en prod (envoyés comme exceptions). Acceptable temporairement. À retirer une fois debug fini. Donne la cause root en 24h.

### Patch P2 — Augmenter `fallbackToCacheTimeout` à 5000ms *(coût: faible, risque: UX dégradée au cold start)*

Dans `app.json` :
```json
"updates": {
  "url": "https://u.expo.dev/...",
  "fallbackToCacheTimeout": 5000
}
```

**Effet** : au cold start, l'app **attend jusqu'à 5s** que le fetch d'update termine avant de lancer le bundle. Si l'update arrive en <5s → appliquée IMMÉDIATEMENT, pas au prochain boot.

**Trade-off** :
- Pro : OTA visible au 1er cold start.
- Con : ajoute potentiellement 5s de splash sur Wi-Fi médiocre/4G. Acceptable mais perceptible.
- Nécessite **un nouveau build natif** (la valeur est dans Expo.plist). Pas d'OTA pour activer ce fix.

### Patch P3 — Retirer la gate `Updates.channel` du banner *(coût: nul, risque: nul)*

```js
- const enabled = Updates && !__DEV__ && Updates.channel;
+ const enabled = Updates && !__DEV__ && Updates.isEnabled;
```

**Justification** : `Updates.isEnabled` reflète l'état réel du module natif (true en prod build). `Updates.channel` peut être faussement vide si EAS n'a pas injecté le header, et masque le vrai problème.

**Trade-off** : aucun. Plus correct sémantiquement. Pousser via OTA (auto-paradoxe : si l'OTA marche pas, ce patch n'arrivera pas chez Yvan).

### Patch P4 — Désactiver la gate `Updates.channel` ET introduire un manuel "Force-check OTA" dans Profil *(coût: moyen, risque: aucun)*

Ajouter dans `src/screens/Profil.js` section Développeur un bouton :
```js
<Pressable onPress={async () => {
  try {
    const r = await Updates.checkForUpdateAsync();
    Alert.alert('OTA', JSON.stringify({
      isAvailable: r.isAvailable,
      channel: Updates.channel,
      runtimeVersion: Updates.runtimeVersion,
    }, null, 2));
    if (r.isAvailable) {
      await Updates.fetchUpdateAsync();
      Alert.alert('OTA', 'Fetched. Reload?', [
        { text: 'OK', onPress: () => Updates.reloadAsync() },
      ]);
    }
  } catch (e) {
    Alert.alert('OTA error', String(e?.message || e));
  }
}}>
  <Text>Force OTA check</Text>
</Pressable>
```

**Trade-off** :
- Pro : Yvan voit en direct le résultat (channel value, isAvailable, error message). Discrimine TOUTES les hypothèses en 30s.
- Con : nécessite un build natif (mais le patch JS peut être préparé maintenant, livré dans build #94 ou #95).
- C'est aussi un outil **permanent de support** : si un bêta-testeur dit "j'ai pas la nouvelle séance", il peut tap ce bouton.

---

## 6. Recommandation finale

**Strategy court terme (semaine prochaine)** : **continuer à debug 1 itération supplémentaire** plutôt que d'accepter de baker dans des builds natifs.

Ordre d'actions :

1. **Test A** (5 min, gratuit) — décompresser l'IPA #93 et lire Expo.plist. Si pas de `EXUpdatesRequestHeaders.expo-channel-name`, c'est le bug, ouvrir un ticket EAS support.
2. **Test B** + **Test C** (10 min, gratuit) — vérifier mapping EAS + curl direct vers `u.expo.dev`. Confirme/infirme côté serveur.
3. **Test D** (10 min, gratuit) — discrimine timing-issue.
4. Si tests A-D ne tranchent pas : intégrer **Patch P1 + P4** dans le **build #94** (déjà en flight selon memory) ou un futur build #95. P1 donne la cause root via Sentry en quelques heures. P4 donne un bouton diagnostic permanent.

**Strategy long terme** : accepter que **les OTAs Fluidbody sont une feature de confort, pas une garantie**. Politique à acter :

- Tout fix critique (crash, paywall cassé, perte de données) → **build natif**, pas OTA.
- OTA = contenu (nouvelles séances), tweaks copy, bugfixes UI non-bloquants.
- Garder un test OTA intégré (le bouton Force-check de P4) pour qu'Yvan vérifie en 10s à chaque build natif que le pipeline OTA tourne.

**Pourquoi ne PAS abandonner les OTAs** : pour une app à 24.90 CHF/mois avec contenu vivant (Sabrina ajoute des séances), perdre les OTAs = devoir builder + soumettre TestFlight à chaque ajout de séance = 2-3 jours de delay vs 30s. Inacceptable pour la roadmap contenu.

---

## 7. Résumé exécutif (pour Yvan, 3 lignes)

> L'audit ne PROUVE pas la cause root (besoin de Test A/B/C pour ça), mais la piste #1 est la plus probable : **EAS a peut-être livré le build #93 sans le header `expo-channel-name=production` embeddé**, ce qui rend le client incapable de demander le bon manifest au serveur. Combo avec le silent-catch dans `OtaUpdateBanner.js` = bug invisible. Reco : décompresser l'IPA #93 et vérifier `Expo.plist` (5 min), puis si besoin patcher le banner avec du verbose Sentry logging dans le build #94 pour avoir une trace en prod.

---

*Fichier généré sans modification du code, sans commit, sans build.*
