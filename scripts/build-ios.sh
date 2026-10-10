#!/usr/bin/env bash
# build-ios.sh : build iOS production dans le cloud EAS + envoi TestFlight.
# Refuse de partir si le code n'est pas commité et poussé (check-clean.sh).
set -e
cd "$(dirname "$0")/.."
./scripts/check-clean.sh
npx eas-cli build --profile production --platform ios --auto-submit "$@"
