#!/usr/bin/env bash
# fin.sh : fin de session en une commande = commit + push sur GitHub.
#   ./scripts/fin.sh "Ce que j'ai changé"
# À lancer avant de quitter un Mac, et avant tout build ou OTA.
set -e
cd "$(dirname "$0")/.."
if [ -z "$1" ]; then echo "Usage : ./scripts/fin.sh \"description du changement\""; exit 1; fi
git add -A
if git diff --cached --quiet; then echo "Rien à commiter."; else git commit -q -m "$1"; echo "✅ Commit : $1"; fi
git push -u origin "$(git branch --show-current)"
echo "✅ Poussé sur GitHub ($(git rev-parse --short HEAD))."
