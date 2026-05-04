#!/usr/bin/env bash
# Uninstall the family-menu launchd agent.
set -euo pipefail

LABEL="com.family-menu.agent"
TARGET="$HOME/Library/LaunchAgents/com.family-menu.agent.plist"
UID_NUM="$(id -u)"

launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true

if [ -f "$TARGET" ]; then
  rm "$TARGET"
  echo "✓ removed $TARGET"
else
  echo "(no plist at $TARGET)"
fi

echo "✓ agent stopped"
