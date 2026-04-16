#!/bin/sh
# Docker often creates backend/node_modules (and dist/) as root. That breaks `npm install`
# on the host. Run this once from the repo root (requires sudo):
#
#   chmod +x scripts/fix-host-perms-after-docker.sh
#   ./scripts/fix-host-perms-after-docker.sh
#
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Removing root-owned workspace package dirs under $ROOT ..."
sudo rm -rf \
  backend/node_modules \
  crm/node_modules \
  customer/node_modules

for dir in backend/dist crm/.next customer/.next; do
  if [ -d "$dir" ] && [ ! -w "$dir" ]; then
    echo "Fixing ownership of $dir ..."
    sudo chown -R "$(id -u):$(id -g)" "$dir" 2>/dev/null || sudo rm -rf "$dir"
  fi
done

echo "Done. Use Node 20.11+ (see .nvmrc), then from repo root run: npm ci"
