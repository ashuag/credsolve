#!/bin/sh
# Used by Docker Compose when the repo is bind-mounted: .next may be missing on first run.
# `routes-manifest.json` is emitted by `next build` and is required before `next start`;
# some Next versions also expect a primed .next when the dev server starts cold.
set -e
cd /workspace/customer

if [ ! -f .next/routes-manifest.json ]; then
  echo "[customer] Running next build (missing .next/routes-manifest.json)..."
  npm run build
fi

exec npm run dev
