#!/usr/bin/env bash
# Install system Chromium on Debian/Ubuntu for Puppeteer PDF generation.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
CHROMIUM_PATH="/usr/bin/chromium"

echo "==> Installing Chromium and fonts (requires sudo)..."
sudo apt-get update
sudo apt-get install -y chromium fonts-liberation fonts-noto-core ca-certificates

if [[ ! -x "$CHROMIUM_PATH" ]]; then
  echo "ERROR: $CHROMIUM_PATH not found after install." >&2
  exit 1
fi

echo "==> Chromium installed at $CHROMIUM_PATH"
"$CHROMIUM_PATH" --version || true

LINE="PUPPETEER_EXECUTABLE_PATH=$CHROMIUM_PATH"
if [[ -f "$ENV_FILE" ]] && grep -q '^PUPPETEER_EXECUTABLE_PATH=' "$ENV_FILE"; then
  sed -i "s|^PUPPETEER_EXECUTABLE_PATH=.*|$LINE|" "$ENV_FILE"
  echo "==> Updated PUPPETEER_EXECUTABLE_PATH in $ENV_FILE"
elif [[ -f "$ENV_FILE" ]]; then
  printf '\n%s\n' "$LINE" >> "$ENV_FILE"
  echo "==> Appended PUPPETEER_EXECUTABLE_PATH to $ENV_FILE"
else
  echo "$LINE" > "$ENV_FILE"
  echo "==> Created $ENV_FILE with PUPPETEER_EXECUTABLE_PATH"
fi

echo ""
echo "Done. Run:  npm run loan-docs:preview-pdf"
