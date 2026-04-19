import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

/**
 * Load env before Nest bootstraps. Typical layout: repo `backend/.env` holds SMTP, DB, etc.
 * - If both `./.env` (cwd) and `backend/.env` exist (e.g. cwd = repo root), load both and let
 *   `backend/.env` override (so secrets stay in `backend/.env`).
 * - If only one exists, that file is loaded.
 */
const cwd = process.cwd();
const cwdEnv = join(cwd, '.env');
const backendEnv = join(cwd, 'backend', '.env');

if (existsSync(cwdEnv)) {
  config({ path: cwdEnv });
}
if (existsSync(backendEnv)) {
  config({ path: backendEnv, override: true });
}
