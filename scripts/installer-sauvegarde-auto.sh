#!/usr/bin/env bash
# Installe la sauvegarde automatique horaire sur ce Mac (à lancer une fois).
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/ch.fluidbody.sauvegarde.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>ch.fluidbody.sauvegarde</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$REPO/scripts/sauvegarde-auto.sh</string></array>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/fluidbody-sauvegarde.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/fluidbody-sauvegarde.log</string>
</dict></plist>
PL
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "✅ Sauvegarde automatique installée (toutes les heures). Journal : ~/Library/Logs/fluidbody-sauvegarde.log"
