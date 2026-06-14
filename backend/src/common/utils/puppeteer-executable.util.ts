import { accessSync, constants, readFileSync } from 'node:fs';

/** Real binaries — prefer over distro wrappers (e.g. Ubuntu `chromium-browser` → snap). */
const PREFERRED_CHROMIUM_PATHS = [
  '/usr/bin/chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
];

const FALLBACK_CHROMIUM_PATHS = ['/usr/bin/chromium-browser', '/snap/bin/chromium'];

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Snap wrappers fail under PM2/systemd (`not a snap cgroup for tag snap.chromium.chromium`). */
function isUnusableChromiumBinary(filePath: string): boolean {
  if (filePath.startsWith('/snap/')) return true;
  try {
    const head = readFileSync(filePath, { encoding: 'utf8' }).slice(0, 4096);
    if (!head.startsWith('#!')) return false;
    const lower = head.toLowerCase();
    return lower.includes('snap') || lower.includes('/snap/bin/chromium');
  } catch {
    return false;
  }
}

function pickFirstUsable(paths: readonly string[]): string | undefined {
  for (const candidate of paths) {
    if (isExecutable(candidate) && !isUnusableChromiumBinary(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Resolve a Chromium/Chrome binary for Puppeteer.
 * Prefers `PUPPETEER_EXECUTABLE_PATH` when the file exists, then common system paths,
 * otherwise returns undefined so Puppeteer can use its bundled browser.
 */
export function resolvePuppeteerExecutablePath(): string | undefined {
  const configured = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (configured) {
    if (isExecutable(configured) && !isUnusableChromiumBinary(configured)) return configured;
    return undefined;
  }

  return pickFirstUsable(PREFERRED_CHROMIUM_PATHS) ?? pickFirstUsable(FALLBACK_CHROMIUM_PATHS);
}
