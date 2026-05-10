import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

/**
 * Load env before Nest bootstraps. Typical layout: repo `backend/.env` holds SMTP, DB, etc.
 * - If both `./.env` (cwd) and `backend/.env` exist (e.g. cwd = repo root), load both and let
 *   `backend/.env` override (so secrets stay in `backend/.env`).
 * - If only one exists, that file is loaded.
 * - Also load `backend/.env` by path from this file so env works when `cwd` is not the package root.
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

/** `src/` → `backend/.env`; compiled `build/src/` → `backend/.env`. */
for (const p of [join(__dirname, '..', '..', '.env'), join(__dirname, '..', '.env')]) {
  if (existsSync(p)) {
    config({ path: p, override: true });
  }
}
