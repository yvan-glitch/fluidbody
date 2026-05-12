# Siri Shortcuts & Apple Intelligence (iOS 17+) — scope

**Statut :** roadmap. Non implémenté dans `feat/premium-indispensable` car requiert
un Swift Intent target (`AppIntents` framework, iOS 16+) et donc un EAS development
build avec un app extension supplémentaire.

## Objectif utilisateur

Yvan peut dire à Siri :

- *« Hey Siri, démarre une séance Fluidbody »* → ouvre la prochaine séance
  recommandée (logique `getSeanceDuJour` déjà en place dans `src/utils.js`).
- *« Hey Siri, fais-moi 10 min de posture »* → ouvre une séance du pilier
  Posture/Dos (`p3` ou `p4` selon mapping).

Et via l'app Shortcuts :

- "Démarrer une séance Fluidbody" → même comportement.
- "Respiration du jour" → ouvre directement le breathing check-in (volet 4).

## Architecture

1. **Swift target `FluidbodyIntents.swift`** dans un nouvel app extension
   (`appIntents`). Définit :
   ```swift
   struct StartSessionIntent: AppIntent {
     static var title: LocalizedStringResource = "Démarrer une séance Fluidbody"
     @Parameter(title: "Durée") var minutes: Int?
     @Parameter(title: "Zone") var zone: ZoneEntity?
     func perform() async throws -> some IntentResult {
       // Open URL fluidbody://start?zone=...&min=...
     }
   }
   ```
2. **Deep link handler** côté JS dans `App.js` (déjà initialisé via
   `react-native-url-polyfill`). Mapper :
   - `fluidbody://start?zone=dos` → MonCorps + ouvrir pilier p3.
   - `fluidbody://breathe` → ouvrir le breathing check-in.
3. **Donations d'intents** : sur chaque séance commencée, donner un
   `IntentDonationManager.shared.donate(StartSessionIntent(...))` pour que
   Siri Suggestions / Apple Intelligence apprennent les habitudes.

## Effort estimé

| Bloc | Effort |
| --- | --- |
| Swift `AppIntent` target | 1 j |
| Deep link routing JS | 0.5 j |
| Intent donations + suggestions | 0.5 j |
| Test Siri physique + Shortcuts app | 0.5 j |

**Total : ~2.5 j ingénieur.**

## Pré-requis

- Comme Live Activity : EAS development build, second app target Swift.
- Bundle id `com.fluidbody.app.Intents`.
- iOS 16+ déjà couvert par le deployment target.

## Low-effort alternative

Sans Swift target, on peut **uniquement** déclarer des URL types iOS et
documenter les URLs dans l'app Shortcuts :

- User crée manuellement un raccourci "Open URL" `fluidbody://start`,
- Lui assigne la phrase "Démarrer Fluidbody".

C'est moche (l'user doit configurer lui-même) mais ça déverrouille la phrase
Siri en 1h d'effort. À considérer si on veut shipper "support Siri" en
marketing avant la version full.

## Apple Intelligence (iOS 26+)

iOS 26 expose `WritingTools`, `Genmoji`, `Image Playground`. **Aucun de ces APIs
n'est utile pour Fluidbody** à ce stade — on ne génère pas de texte ou d'image.
Le seul vrai vecteur iOS 26 pour nous c'est :

- **Predicted Shortcuts** via `AppIntents` (couvert ci-dessus).
- **Spotlight indexing** des séances (`CSSearchableItem`) → ouvrir une séance
  depuis une recherche Spotlight. 0.5 j d'effort si l'AppIntent target existe.

## Liens

- Apple AppIntents : https://developer.apple.com/documentation/appintents
- Donations & Predicted Shortcuts : https://developer.apple.com/documentation/foundation/app_intents/making_actions_and_content_discoverable_and_widely_available
