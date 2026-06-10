import { accessSync, constants } from 'node:fs';

const COMMON_CHROMIUM_PATHS = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
];

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a Chromium/Chrome binary for Puppeteer.
 * Prefers `PUPPETEER_EXECUTABLE_PATH` when the file exists, then common system paths,
 * otherwise returns undefined so Puppeteer can use its bundled browser.
 */
export function resolvePuppeteerExecutablePath(): string | undefined {
  const configured = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (configured) {
    if (isExecutable(configured)) return configured;
    return undefined;
  }

  for (const candidate of COMMON_CHROMIUM_PATHS) {
    if (isExecutable(candidate)) return candidate;
  }

  return undefined;
}
