# Sentry setup — crash monitoring (TestFlight + App Store)

Sentry est intégré dans l'app mais reste **no-op tant que le DSN n'est pas fourni**.
Pour l'activer en prod, suivre les étapes ci-dessous.

## Comment ça marche côté code

- `App.js:11-36` : import safe-require de `@sentry/react-native`, init **uniquement**
  si `process.env.EXPO_PUBLIC_SENTRY_DSN` est non vide.
- `App.js:37-46` : helper `sentryCapture(error, ctx)` utilisable partout (no-op si DSN vide).
- `beforeSend` strip déjà `event.user.email`, `ip_address`, `username` (PII out).
- `ErrorBoundary` forward les erreurs JS render via `onError`.

Le DSN est une variable **publique** (préfixe `EXPO_PUBLIC_`) → bundlée au build.
Pas de secret côté serveur, juste un identifiant projet Sentry.

## Procédure (5 min, à faire une seule fois)

### 1. Créer le projet sur sentry.io

1. Aller sur https://sentry.io (créer un compte si besoin)
2. **New Project** → choisir la plateforme **React Native**
3. Nom du projet : `fluidbody`
4. Team : choisir ou créer
5. **Create Project**

Sentry affiche alors une page d'instructions avec le **DSN** du type :
```
https://abcdef0123456789@o1234567.ingest.sentry.io/1234567
```

Copier ce DSN.

### 2. Injecter le DSN dans les builds EAS

```bash
eas env:create production EXPO_PUBLIC_SENTRY_DSN=https://abcdef0123456789@o1234567.ingest.sentry.io/1234567
eas env:create preview    EXPO_PUBLIC_SENTRY_DSN=https://abcdef0123456789@o1234567.ingest.sentry.io/1234567
```

(Optionnel mais recommandé) — ajouter aussi en local pour tester :
```bash
echo "EXPO_PUBLIC_SENTRY_DSN=https://abcdef0123456789@o1234567.ingest.sentry.io/1234567" >> .env
```

### 3. Rebuild les deux plateformes

```bash
# iPhone (channel production)
eas build --profile production --platform ios

# Apple TV (channel production-tv)
eas build --profile production-tv --platform ios
```

Les builds vont récupérer la var `EXPO_PUBLIC_SENTRY_DSN` au moment du bundling,
donc le DSN est figé dans le bundle.

> **Note** : le build Apple TV était en retard (build 81 du 22 mai vs build 83 iPhone du 25 mai).
> Le rebuild ci-dessus aligne les deux et active Sentry sur TV en même temps.

### 4. Vérifier que ça marche

1. Installer le build dev sur appareil
2. Forcer une erreur de test : ouvrir un dev menu et déclencher un throw, ou
   ajouter temporairement `throw new Error('sentry test')` dans un handler
3. Vérifier sur https://sentry.io/issues que l'event arrive
4. Vérifier que `event.user.email` est bien `undefined` (PII strip OK)

### 5. (Plus tard) Sourcemaps + dSYM upload

Pour symboliser les crashes natifs iOS, il faut uploader le dSYM à chaque build.
Pas critique pour la submission immédiate — peut être wiré plus tard via un
post-publish hook EAS avec `sentry-cli` (`sentry-expo` propose un plugin
config qui automatise ce step).

## Désactivation temporaire

Si Sentry pose problème en prod (rate limit, crash dans l'init, etc.) :

```bash
eas env:rm production EXPO_PUBLIC_SENTRY_DSN
eas update --branch production --message "disable sentry"
```

Le DSN devient vide → init no-op → app reprend sans Sentry sans rebuild natif.

## Liens

- Dashboard Sentry projet : https://sentry.io/issues/?project=fluidbody
- Doc Sentry React Native : https://docs.sentry.io/platforms/react-native/
- EAS env vars : https://docs.expo.dev/eas-update/environment-variables/
