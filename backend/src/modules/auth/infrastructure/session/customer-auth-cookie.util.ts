import type { CookieOptions } from 'express';

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

/**
 * When the customer SPA is on `www` but API calls go to `api` (different hosts), the default
 * host-only session cookie is invisible to `www` (e.g. `/auth/google/login` on Next). Set
 * `CUSTOMER_AUTH_COOKIE_DOMAIN=moneycash.in` in production so the cookie is sent to both subdomains.
 * Omit in local dev (never set to `localhost`).
 */
function resolveCustomerAuthCookieDomain(): string | undefined {
  const raw = (process.env.CUSTOMER_AUTH_COOKIE_DOMAIN ?? '').trim();
  if (!raw || raw.includes('/') || raw.includes(':') || raw.includes(' ')) {
    return undefined;
  }
  const normalized = raw.replace(/^\.+/, '').toLowerCase();
  if (normalized === 'localhost' || !normalized.includes('.')) {
    return undefined;
  }
  return `.${normalized}`;
}

export function buildCustomerAuthCookieOptions(maxAgeMs: number): CookieOptions {
  const opts: CookieOptions = {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
  const domain = resolveCustomerAuthCookieDomain();
  if (domain) {
    opts.domain = domain;
  }
  return opts;
}

/** Options for `res.clearCookie` — must match what was used when the cookie was set. */
export function buildCustomerAuthCookieClearOptions(): Pick<
  CookieOptions,
  'httpOnly' | 'secure' | 'sameSite' | 'path' | 'domain'
> {
  const domain = resolveCustomerAuthCookieDomain();
  const base = {
    httpOnly: true as const,
    secure: isProduction(),
    sameSite: 'lax' as const,
    path: '/',
  };
  return domain ? { ...base, domain } : base;
}
