#!/usr/bin/env node
/**
 * Ensures a Chromium/Chrome binary exists for loan-document PDF generation.
 * - Skips when PUPPETEER_SKIP_DOWNLOAD=true (system browser must be configured).
 * - Skips when a usable system browser is already on PATH.
 * - Otherwise installs Puppeteer's bundled Chrome into PUPPETEER_CACHE_DIR
 *   (default ~/.cache/puppeteer).
 */
import { accessSync, constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChromiumPath } from './lib/puppeteer-launch.mjs';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function hasBundledBrowser(puppeteer) {
  try {
    const bundled = puppeteer.executablePath();
    return Boolean(bundled && isExecutable(bundled));
  } catch {
    return false;
  }
}

async function isChromeReady() {
  if (process.env.PUPPETEER_SKIP_DOWNLOAD === 'true') {
    return Boolean(resolveChromiumPath());
  }
  if (resolveChromiumPath()) {
    return true;
  }
  try {
    const puppeteer = (await import('puppeteer')).default;
    return hasBundledBrowser(puppeteer);
  } catch {
    return false;
  }
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) {
    process.exit((await isChromeReady()) ? 0 : 1);
  }

  if (process.env.PUPPETEER_SKIP_DOWNLOAD === 'true') {
    const systemPath = resolveChromiumPath();
    if (!systemPath) {
      console.warn(
        '[ensure-puppeteer-chrome] PUPPETEER_SKIP_DOWNLOAD=true but no system Chromium was found. ' +
          'Run: npm run loan-docs:setup-chromium',
      );
    }
    return;
  }

  if (resolveChromiumPath()) {
    return;
  }

  const puppeteer = (await import('puppeteer')).default;
  if (hasBundledBrowser(puppeteer)) {
    return;
  }

  const cacheDir = process.env.PUPPETEER_CACHE_DIR?.trim();
  console.log(
    `[ensure-puppeteer-chrome] Installing Puppeteer Chrome${cacheDir ? ` (cache: ${cacheDir})` : ''}...`,
  );

  const result = spawnSync('npx', ['puppeteer', 'browsers', 'install', 'chrome'], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    console.warn(
      '[ensure-puppeteer-chrome] Browser install failed. Loan PDF generation needs Chrome/Chromium. ' +
        'Docker: rebuild backend container. VPS: npm run loan-docs:setup-chromium',
    );
    process.exit(result.status ?? 1);
  }

  console.log('[ensure-puppeteer-chrome] Puppeteer Chrome is ready.');
}

main().catch((err) => {
  console.warn('[ensure-puppeteer-chrome]', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
