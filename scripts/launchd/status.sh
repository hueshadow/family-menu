#!/usr/bin/env bash
# Show the current launchd agent status.
set -euo pipefail

LABEL="com.family-menu.agent"
UID_NUM="$(id -u)"

if launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1; then
  echo "▶ agent loaded: $LABEL"
  launchctl print "gui/$UID_NUM/$LABEL" | grep -E "(state|pid|last exit|program|stdout|stderr)" | sed "s/^/    /"
else
  echo "✗ agent not loaded"
fi

if curl -sf -o /dev/null http://localhost:3000/api/health; then
  echo "▶ HTTP OK on :3000"
else
  echo "✗ no HTTP response on :3000"
fi

if [ -f "$HOME/Library/Logs/family-menu.err.log" ]; then
  echo ""
  echo "── recent stderr ──"
  tail -5 "$HOME/Library/Logs/family-menu.err.log" 2>/dev/null || true
fi
