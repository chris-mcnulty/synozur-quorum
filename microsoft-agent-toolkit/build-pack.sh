#!/usr/bin/env bash
# Build a sideloadable pack.zip for the Microsoft 365 Agents Toolkit.
#
# Usage:  REPLIT_DOMAIN=your-app.replit.app ./build-pack.sh [output]
# Output: pack.zip (default) — drop into VS Code "Sideload package…".
#
# Required env:
#   REPLIT_DOMAIN   Your published Quorum domain, e.g. quorum-abc123.replit.app
#                   Falls back to the REPLIT_DOMAINS env var (comma-separated;
#                   first value is used) if REPLIT_DOMAIN is not set.

set -euo pipefail

OUTPUT="${1:-pack.zip}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Resolve OUTPUT to an absolute path so it is still correct after `cd "$HERE"`
case "$OUTPUT" in
  /*) ABS_OUTPUT="$OUTPUT" ;;
  *)  ABS_OUTPUT="$(pwd)/$OUTPUT" ;;
esac

# ── Resolve domain ───────────────────────────────────────────────────────────
if [[ -z "${REPLIT_DOMAIN:-}" ]]; then
  if [[ -z "${REPLIT_DOMAINS:-}" ]]; then
    echo "Error: set REPLIT_DOMAIN (or REPLIT_DOMAINS) before running." >&2
    echo "  Example: REPLIT_DOMAIN=quorum-abc123.replit.app ./build-pack.sh" >&2
    exit 1
  fi
  # REPLIT_DOMAINS is comma-separated; take the first entry
  REPLIT_DOMAIN="${REPLIT_DOMAINS%%,*}"
fi

echo "Using domain: $REPLIT_DOMAIN"

cd "$HERE"

if [[ ! -f manifest.json ]]; then
  echo "manifest.json missing — run from microsoft-agent-toolkit/" >&2
  exit 1
fi

# ── Validate icons ────────────────────────────────────────────────────────────
for icon in icons/color.png icons/outline.png; do
  if [[ ! -f "$icon" ]]; then
    echo "Error: $icon is missing. Run the icon generator first." >&2
    exit 1
  fi
done

# ── Stage files with domain substituted ──────────────────────────────────────
cp -r icons "$WORK/"

for src in manifest.json declarativeAgent.json mcpManifest.json; do
  sed "s|\${REPLIT_DOMAIN}|${REPLIT_DOMAIN}|g" "$src" > "$WORK/$src"
done

# Also substitute any occurrence in copilot-studio-connector.yaml if present
if [[ -f copilot-studio-connector.yaml ]]; then
  sed "s|\${REPLIT_DOMAIN}|${REPLIT_DOMAIN}|g" copilot-studio-connector.yaml \
    > "$WORK/copilot-studio-connector.yaml"
fi

# ── Build zip ────────────────────────────────────────────────────────────────
rm -f "$ABS_OUTPUT"

EXTRA_YAML=""
[[ -f copilot-studio-connector.yaml ]] && EXTRA_YAML="copilot-studio-connector.yaml"

if command -v zip &>/dev/null; then
  (cd "$WORK" && zip -r "$ABS_OUTPUT" \
    manifest.json \
    declarativeAgent.json \
    mcpManifest.json \
    icons \
    ${EXTRA_YAML} \
    >/dev/null)
else
  # Fallback: use Python's built-in zipfile module (available on all platforms)
  python3 - "$ABS_OUTPUT" "$WORK" ${EXTRA_YAML} <<'PYEOF'
import sys, zipfile, os, pathlib

out_path  = sys.argv[1]
work_dir  = pathlib.Path(sys.argv[2])
extra_yaml = sys.argv[3] if len(sys.argv) > 3 else None

entries = ["manifest.json", "declarativeAgent.json", "mcpManifest.json", "icons"]
if extra_yaml:
    entries.append(extra_yaml)

with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for entry in entries:
        p = work_dir / entry
        if p.is_dir():
            for f in sorted(p.rglob("*")):
                if f.is_file():
                    zf.write(f, f.relative_to(work_dir))
        elif p.is_file():
            zf.write(p, entry)
PYEOF
fi

echo "Built $OUTPUT (domain: $REPLIT_DOMAIN)"
