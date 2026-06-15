#!/bin/sh
# Installs Chrome runtime libraries + Puppeteer bundled Chrome (backend Docker dev).
# Run in the background so Nest can start immediately.
set -eu

APP_DIR="$1"
LOG_FILE="$APP_DIR/.cache/puppeteer-setup.log"

mkdir -p "$APP_DIR/.cache"

{
  echo "[puppeteer-setup] Starting at $(date -Iseconds)"

  DEPS_STAMP="$APP_DIR/node_modules/.puppeteer-runtime-deps-stamp"
  if [ ! -f "$DEPS_STAMP" ] && command -v apt-get >/dev/null 2>&1; then
    echo "[puppeteer-setup] Installing Chrome runtime libraries..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq \
      ca-certificates fonts-liberation fonts-noto-core \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 \
      libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
      libpango-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 \
      libxext6 libxfixes3 libxkbcommon0 libxrandr2 libxshmfence1 libxss1
    touch "$DEPS_STAMP"
    echo "[puppeteer-setup] Runtime libraries installed."
  fi

  if [ -f "$APP_DIR/scripts/ensure-puppeteer-chrome.mjs" ]; then
    node "$APP_DIR/scripts/ensure-puppeteer-chrome.mjs"
  fi

  echo "[puppeteer-setup] Done at $(date -Iseconds)"
} >>"$LOG_FILE" 2>&1
