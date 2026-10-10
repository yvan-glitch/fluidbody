#!/usr/bin/env bash
# Sauvegarde automatique (launchd, toutes les heures) : commit + push si quelque chose a changé.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
if [ -z "$(git status --porcelain)" ]; then exit 0; fi
git add -A
git commit -q -m "Sauvegarde automatique du $(date '+%d.%m.%Y %H:%M')" || exit 0
git push -q origin "$(git branch --show-current)" && echo "$(date '+%d.%m.%Y %H:%M') poussé $(git rev-parse --short HEAD)"
