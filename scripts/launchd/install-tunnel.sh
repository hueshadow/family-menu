#!/usr/bin/env bash
# Install the cloudflared launchd agent for the family-menu tunnel.
# Prerequisite: `cloudflared tunnel login` was completed and
# `~/.cloudflared/config.yml` exists pointing to the tunnel `family-menu`.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/com.family-menu.tunnel.template.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET="$TARGET_DIR/com.family-menu.tunnel.plist"
LABEL="com.family-menu.tunnel"
UID_NUM="$(id -u)"

if [ ! -f "$HOME/.cloudflared/config.yml" ]; then
  echo "✗ ~/.cloudflared/config.yml missing — finish 'cloudflared tunnel login' first."
  exit 1
fi

mkdir -p "$TARGET_DIR" "$HOME/Library/Logs"

sed -e "s|__HOME__|$HOME|g" "$TEMPLATE" > "$TARGET"

# Reload if already loaded
launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true

# Stop any foreground cloudflared we may have left running
pkill -f "cloudflared tunnel run family-menu" 2>/dev/null || true
sleep 1

launchctl bootstrap "gui/$UID_NUM" "$TARGET"
launchctl kickstart -k "gui/$UID_NUM/$LABEL"

echo "✓ tunnel agent installed and started"
echo "  plist:    $TARGET"
echo "  logs:     $HOME/Library/Logs/family-menu-tunnel.{out,err}.log"
echo ""
echo "Verify:"
echo "  curl https://familymenu.xyz/api/health"
echo "  tail -F $HOME/Library/Logs/family-menu-tunnel.out.log"
echo ""
echo "Uninstall:"
echo "  launchctl bootout gui/$UID_NUM/$LABEL"
echo "  rm $TARGET"
