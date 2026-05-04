#!/usr/bin/env bash
# Install the family-menu launchd agent. Re-runnable.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE="$SCRIPT_DIR/com.family-menu.template.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET="$TARGET_DIR/com.family-menu.agent.plist"
START_SH="$SCRIPT_DIR/start.sh"
LABEL="com.family-menu.agent"
UID_NUM="$(id -u)"

chmod +x "$START_SH"
mkdir -p "$TARGET_DIR" "$HOME/Library/Logs"

# Substitute placeholders → final plist
sed \
  -e "s|__START_SH__|$START_SH|g" \
  -e "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" \
  -e "s|__HOME__|$HOME|g" \
  "$TEMPLATE" > "$TARGET"

# Reload if already loaded (idempotent)
launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true

launchctl bootstrap "gui/$UID_NUM" "$TARGET"
launchctl kickstart -k "gui/$UID_NUM/$LABEL"

echo "✓ installed and started"
echo "  plist:    $TARGET"
echo "  start.sh: $START_SH"
echo "  logs:     $HOME/Library/Logs/family-menu.{out,err}.log"
echo ""
echo "Next steps:"
echo "  - Wait ~10–60s for the first build, then visit http://localhost:3000"
echo "  - Check logs:    tail -F ~/Library/Logs/family-menu.out.log"
echo "  - Check status:  bash $SCRIPT_DIR/status.sh"
echo "  - Uninstall:     bash $SCRIPT_DIR/uninstall.sh"
