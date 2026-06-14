import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

const PREFERRED_CHROMIUM_PATHS = [
  '/usr/bin/chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
];

const FALLBACK_CHROMIUM_PATHS = ['/usr/bin/chromium-browser', '/snap/bin/chromium'];

export const CHROMIUM_INSTALL_HINT = `
Loan PDF preview needs Chromium. On this server, run once:

  cd backend
  npm run loan-docs:setup-chromium

Or manually:

  sudo apt-get update
  sudo apt-get install -y chromium fonts-liberation fonts-noto-core ca-certificates
  echo 'PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium' >> backend/.env

See backend/assets/loan-documents/README.md
`.trim();

function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isUnusableChromiumBinary(filePath) {
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

function pickFirstUsable(paths) {
  for (const candidate of paths) {
    if (isExecutable(candidate) && !isUnusableChromiumBinary(candidate)) return candidate;
  }
  return undefined;
}

export function resolveChromiumPath() {
  const configured = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (configured) {
    if (isExecutable(configured) && !isUnusableChromiumBinary(configured)) return configured;
    return undefined;
  }
  return pickFirstUsable(PREFERRED_CHROMIUM_PATHS) ?? pickFirstUsable(FALLBACK_CHROMIUM_PATHS);
}

export function loadBackendEnv(backendRoot) {
  const envPath = path.join(backendRoot, '.env');
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath });
  }
}

/**
 * @param {import('puppeteer').PuppeteerNode} puppeteer
 * @param {string} backendRoot absolute path to backend/
 */
export async function launchPuppeteerBrowser(puppeteer, backendRoot) {
  loadBackendEnv(backendRoot);

  const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  const executablePath = resolveChromiumPath();

  if (configuredPath && !executablePath) {
    console.warn(
      `PUPPETEER_EXECUTABLE_PATH="${configuredPath}" is missing, not executable, or is a Snap wrapper.`,
    );
  } else if (executablePath) {
    console.log(`Using Chromium at ${executablePath}`);
  } else {
    console.warn('No system Chromium found — trying Puppeteer bundled Chrome (often fails on minimal VPS).');
    console.warn('Run: npm run loan-docs:setup-chromium');
  }

  const launchOptions = {
    headless: true,
    timeout: 60_000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    ...(executablePath ? { executablePath } : {}),
  };

  try {
    return await puppeteer.launch(launchOptions);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('shared libraries')
      || message.includes('Failed to launch the browser process')
      || message.includes('Code: 127')
    ) {
      throw new Error(`${message}\n\n${CHROMIUM_INSTALL_HINT}`);
    }
    throw err;
  }
}
