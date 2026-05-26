#!/usr/bin/env bash
# push-update.sh — Publie une update EAS aux 2 channels (iOS + tvOS).
#
# Usage:
#   ./scripts/push-update.sh "Description du changement"
#   ./scripts/push-update.sh "Ajout séance Posture Dos Avancée"
#
# Le message décrit ce qui change pour les utilisateurs.
# Publié à `production` (iPhone) et `production-tv` (Apple TV) simultanément.
#
# Limitations OTA (rappel) :
#   - Pas de changements natifs (deps, plugins, icons, Info.plist)
#   - Quand `version` bumpe dans app.json (1.0.0 → 1.0.1), les anciens
#     builds (1.0.0) ne reçoivent plus → il faut rebuilder ces channels.
#   - Tout JS pur passe (data.js, screens, components, utils).

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/push-update.sh \"Description du changement\""
  echo ""
  echo "Exemples :"
  echo "  ./scripts/push-update.sh \"Ajout séance Posture Dos Avancée\""
  echo "  ./scripts/push-update.sh \"Fix bug navigation Apple Watch\""
  echo "  ./scripts/push-update.sh \"Refonte UI screen MonCorps\""
  exit 1
fi

MESSAGE="$1"

echo "🚀 Publishing OTA update to production + production-tv channels..."
echo ""
echo "Message: $MESSAGE"
echo ""

# Channel iPhone (iOS production)
echo "📱 Pushing to production (iPhone)..."
eas update --branch production --message "$MESSAGE" --non-interactive

echo ""

# Channel Apple TV
echo "📺 Pushing to production-tv (Apple TV)..."
eas update --branch production-tv --message "$MESSAGE" --non-interactive

echo ""
echo "✅ Update published to both iPhone and Apple TV."
echo ""
echo "Les utilisateurs verront l'update au prochain lancement de l'app."
echo "Suivi sur EAS Dashboard : https://expo.dev/accounts/ytissot/projects/fluidbody/updates"
