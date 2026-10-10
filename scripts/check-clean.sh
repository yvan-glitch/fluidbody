#!/usr/bin/env bash
# check-clean.sh : refuse de continuer si le code n'est pas commité ET poussé sur GitHub.
# Appelé par push-update.sh et build-ios.sh. Règle du 10.10.2026 : on ne construit
# jamais un build ni une OTA depuis un arbre non commité (sinon impossible de
# retrouver quel code tourne sur les téléphones).
set -e
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "❌ Modifications non commitées. Lance d'abord :  ./scripts/fin.sh \"description\""
  git status --short --untracked-files=no
  exit 1
fi
git fetch -q origin main || true
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main 2>/dev/null || echo none)
if [ "$LOCAL" != "$REMOTE" ]; then
  if git merge-base --is-ancestor "$REMOTE" "$LOCAL" 2>/dev/null; then
    echo "❌ Commits locaux pas encore poussés sur GitHub. Lance :  git push"
  else
    echo "❌ Ce clone n'est pas à jour avec GitHub (origin/main a avancé). Lance :  git pull"
  fi
  exit 1
fi
echo "✅ Code commité et identique à GitHub ($(git rev-parse --short HEAD))."
