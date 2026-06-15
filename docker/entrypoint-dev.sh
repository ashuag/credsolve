#!/bin/sh
# Ensures the current app directory installs from its own package-lock.json.
set -e

APP_DIR=$(pwd)
if [ ! -f "$APP_DIR/package-lock.json" ]; then
  echo "error: $APP_DIR/package-lock.json is missing" >&2
  exit 1
fi

STAMP="$APP_DIR/node_modules/.lockfile-stamp"
LOCKDIR="$APP_DIR/node_modules/.install-lock"
LOCK_SIG=$(md5sum "$APP_DIR/package-lock.json" | cut -d' ' -f1)

mkdir -p "$APP_DIR/node_modules"

LOCK_ACQUIRED=0
while true; do
  if mkdir "$LOCKDIR" 2>/dev/null; then
    LOCK_ACQUIRED=1
    trap 'rmdir "$LOCKDIR" 2>/dev/null || true' EXIT INT TERM
    break
  fi

  if [ -f "$STAMP" ] && [ "$(cat "$STAMP" 2>/dev/null)" = "$LOCK_SIG" ]; then
    break
  fi

  echo "waiting for app node_modules install..."
  sleep 2
done

if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP" 2>/dev/null)" != "$LOCK_SIG" ]; then
  echo "npm ci ($APP_DIR)..."
  cd "$APP_DIR"
  npm ci
  echo "$LOCK_SIG" > "$STAMP"
fi

if [ -f "$APP_DIR/prisma.config.ts" ] && grep -q '"prisma:generate"' "$APP_DIR/package.json"; then
  echo "prisma generate ($APP_DIR)..."
  cd "$APP_DIR"
  npm run prisma:generate
fi

# Backend loan-document PDFs need Chrome/Chromium + runtime libraries (Docker slim images lack both).
# Do not block API startup — download/install runs in the background on first boot.
if grep -q '"puppeteer"' "$APP_DIR/package.json" 2>/dev/null; then
  if [ -f "$APP_DIR/scripts/ensure-puppeteer-chrome.mjs" ] \
    && node "$APP_DIR/scripts/ensure-puppeteer-chrome.mjs" --check >/dev/null 2>&1; then
    : # Chrome already available
  elif [ -f "$APP_DIR/scripts/setup-puppeteer-docker.sh" ]; then
    echo "Puppeteer Chrome not ready — installing in background (API starting now; see backend/.cache/puppeteer-setup.log)..."
    sh "$APP_DIR/scripts/setup-puppeteer-docker.sh" "$APP_DIR" &
  fi
fi

if [ "$LOCK_ACQUIRED" -eq 1 ]; then
  rmdir "$LOCKDIR" 2>/dev/null || true
  trap - EXIT INT TERM
fi

cd "$APP_DIR"
exec "$@"
