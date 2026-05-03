#!/usr/bin/env bash
# Build a sideloadable pack.zip for the Microsoft 365 Agents Toolkit.
#
# Usage:  ./build-pack.sh [output]
# Output: pack.zip (default) — drop into VS Code "Sideload package…".

set -euo pipefail

OUTPUT="${1:-pack.zip}"
HERE="$(cd "$(dirname "$0")" && pwd)"

cd "$HERE"

if [[ ! -f manifest.json ]]; then
  echo "manifest.json missing — run from microsoft-agent-toolkit/" >&2
  exit 1
fi

rm -f "$OUTPUT"

zip -r "$OUTPUT" \
  manifest.json \
  declarativeAgent.json \
  mcpManifest.json \
  icons \
  >/dev/null

echo "Built $OUTPUT"
