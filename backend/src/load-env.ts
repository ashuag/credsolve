import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

/** Docker `env_file` / host exports win over `.env` for AWS keys (avoids bad re-parse of secrets). */
const AWS_ENV_PRESERVE = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'] as const;

function snapshotAwsEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of AWS_ENV_PRESERVE) {
    const v = process.env[key]?.trim();
    if (v) out[key] = v;
  }
  return out;
}

function restoreAwsEnv(snapshot: Record<string, string>): void {
  for (const [key, value] of Object.entries(snapshot)) {
    process.env[key] = value;
  }
}

/**
 * Load env before Nest bootstraps. Typical layout: repo `backend/.env` holds SMTP, DB, etc.
 * - If both `./.env` (cwd) and `backend/.env` exist (e.g. cwd = repo root), load both and let
 *   `backend/.env` override (so secrets stay in `backend/.env`).
 * - If only one exists, that file is loaded.
 * - Also load `backend/.env` by path from this file so env works when `cwd` is not the package root.
 * - AWS keys already set (e.g. Docker `env_file`) are restored after override loads so a stray
 *   character in `.env` cannot break request signing.
 */
const cwd = process.cwd();
const cwdEnv = join(cwd, '.env');
const backendEnv = join(cwd, 'backend', '.env');
const awsFromHost = snapshotAwsEnv();

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

restoreAwsEnv(awsFromHost);
