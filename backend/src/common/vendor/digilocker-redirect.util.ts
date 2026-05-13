import { BadRequestException } from '@nestjs/common';

/**
 * Builds the default post-login redirect when the client omits `redirectUrl`.
 * Env: `DIGILOCKER_REDIRECT_URL` (full URL) overrides `CUSTOMER_PORTAL_BASE_URL` + `DIGILOCKER_REDIRECT_PATH`.
 */
export function resolveDigilockerRedirectUrl(clientRedirect: string | undefined): string {
  const trimmed = clientRedirect?.trim();
  if (trimmed) {
    assertAllowedDigilockerRedirect(trimmed);
    return trimmed;
  }

  const full = process.env.DIGILOCKER_REDIRECT_URL?.trim();
  if (full) {
    assertAllowedDigilockerRedirect(full);
    return full;
  }

  const base = (process.env.CUSTOMER_PORTAL_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    throw new BadRequestException(
      'Set CUSTOMER_PORTAL_BASE_URL (or DIGILOCKER_REDIRECT_URL), or send redirectUrl in the request body.',
    );
  }
  const path = (process.env.DIGILOCKER_REDIRECT_PATH ?? '/kyc/digilocker-callback').trim();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const joined = `${base}${suffix}`;
  assertAllowedDigilockerRedirect(joined);
  return joined;
}

export function assertAllowedDigilockerRedirect(url: string): void {
  const prefixes: string[] = [];
  const csv = process.env.DIGILOCKER_REDIRECT_ALLOWED_PREFIXES?.trim();
  if (csv) {
    for (const p of csv.split(',')) {
      const t = p.trim().replace(/\/+$/, '');
      if (t) prefixes.push(t);
    }
  }
  for (const key of ['CUSTOMER_PORTAL_BASE_URL', 'BACKEND_PUBLIC_BASE_URL'] as const) {
    const t = process.env[key]?.trim().replace(/\/+$/, '');
    if (t) prefixes.push(t);
  }
  const unique = [...new Set(prefixes)];
  if (unique.length === 0) {
    throw new BadRequestException(
      'Set DIGILOCKER_REDIRECT_ALLOWED_PREFIXES and/or CUSTOMER_PORTAL_BASE_URL (and optionally BACKEND_PUBLIC_BASE_URL) to validate redirectUrl.',
    );
  }
  const ok = unique.some((p) => url.startsWith(p));
  if (!ok) {
    throw new BadRequestException(
      `redirectUrl must start with one of the configured prefixes (e.g. CUSTOMER_PORTAL_BASE_URL).`,
    );
  }
}
