#!/usr/bin/env bash
# Wrapper invoked by launchd. Cd to the project root, ensure build artifacts
# exist, then start the production server bound to all interfaces.
set -euo pipefail

# Resolve the project root from this script's location: scripts/launchd/start.sh → ../..
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Ensure the npm/node binaries on PATH (Homebrew Apple Silicon default)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

mkdir -p "$HOME/Library/Logs"

if [ ! -d ".next" ]; then
  echo "[start.sh] no .next/ — running npm run build first" >&2
  npm run build
fi

exec npm run start:lan
