#!/usr/bin/env bash
# Install a real Chrome/Chromium binary for Puppeteer on Debian/Ubuntu VPS hosts.
# Ubuntu 24.04+ `apt install chromium` is often a Snap wrapper — we install Google Chrome .deb instead.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

is_usable_browser() {
  local candidate="$1"
  [[ -x "$candidate" ]] || return 1
  if [[ "$candidate" == /snap/* ]]; then
    return 1
  fi
  if head -n 1 "$candidate" 2>/dev/null | grep -q '^#!'; then
    if grep -qiE 'snap|/snap/bin/chromium' "$candidate" 2>/dev/null; then
      return 1
    fi
  fi
  return 0
}

pick_browser() {
  local candidate
  for candidate in \
    /usr/bin/google-chrome-stable \
    /usr/bin/google-chrome \
    /usr/bin/chromium; do
    if is_usable_browser "$candidate"; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

set_env_browser_path() {
  local browser_path="$1"
  local line="PUPPETEER_EXECUTABLE_PATH=$browser_path"
  if [[ -f "$ENV_FILE" ]] && grep -q '^PUPPETEER_EXECUTABLE_PATH=' "$ENV_FILE"; then
    sed -i "s|^PUPPETEER_EXECUTABLE_PATH=.*|$line|" "$ENV_FILE"
    echo "==> Updated PUPPETEER_EXECUTABLE_PATH in $ENV_FILE"
  elif [[ -f "$ENV_FILE" ]]; then
    printf '\n%s\n' "$line" >> "$ENV_FILE"
    echo "==> Appended PUPPETEER_EXECUTABLE_PATH to $ENV_FILE"
  else
    echo "$line" > "$ENV_FILE"
    echo "==> Created $ENV_FILE with PUPPETEER_EXECUTABLE_PATH"
  fi
}

clear_env_browser_path() {
  if [[ -f "$ENV_FILE" ]] && grep -q '^PUPPETEER_EXECUTABLE_PATH=' "$ENV_FILE"; then
    sed -i '/^PUPPETEER_EXECUTABLE_PATH=/d' "$ENV_FILE"
    echo "==> Removed invalid PUPPETEER_EXECUTABLE_PATH from $ENV_FILE (using bundled Chrome)"
  fi
}

install_runtime_libs() {
  echo "==> Installing fonts and Chrome/Puppeteer runtime libraries..."
  sudo apt-get update
  sudo apt-get install -y \
    ca-certificates wget fonts-liberation fonts-noto-core \
    libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libcairo2 libcups2t64 \
    libdbus-1-3 libdrm2 libgbm1 libglib2.0-0t64 libnspr4 libnss3 libpango-1.0-0 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxkbcommon0 libxrandr2 libxshmfence1 \
    || sudo apt-get install -y \
    ca-certificates wget fonts-liberation fonts-noto-core \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 \
    libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libnspr4 libnss3 libpango-1.0-0 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxkbcommon0 libxrandr2 libxshmfence1
}

install_google_chrome() {
  if is_usable_browser /usr/bin/google-chrome-stable; then
    echo "==> Google Chrome already installed"
    return 0
  fi

  echo "==> Installing Google Chrome (.deb) — recommended on Ubuntu 24.04+ (apt chromium is Snap-only)..."
  local tmp
  tmp="$(mktemp --suffix=.deb)"
  wget -q -O "$tmp" https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  if ! sudo apt-get install -y "$tmp"; then
    sudo apt-get install -f -y
    sudo apt-get install -y "$tmp"
  fi
  rm -f "$tmp"
}

install_runtime_libs
install_google_chrome || true

BROWSER_PATH=""
if BROWSER_PATH="$(pick_browser)"; then
  echo "==> Using browser at $BROWSER_PATH"
  "$BROWSER_PATH" --version || true
  set_env_browser_path "$BROWSER_PATH"
else
  echo "==> No system Chrome/Chromium binary found; using Puppeteer bundled Chrome with runtime libraries."
  clear_env_browser_path
fi

echo ""
echo "Done. Run:  npm run loan-docs:preview-pdf"
