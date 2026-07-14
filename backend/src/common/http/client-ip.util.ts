import type { Request } from 'express';

/**
 * Normalize Express / Node peer addresses for storage and display.
 * - `::ffff:1.2.3.4` → `1.2.3.4` (IPv4-mapped IPv6)
 * - trim whitespace
 */
export function normalizeClientIp(ip: string | undefined | null): string | undefined {
  if (!ip) return undefined;
  const trimmed = ip.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('::ffff:')) {
    return trimmed.slice(7);
  }
  return trimmed;
}

/**
 * Best-effort client IP for audit fields (OTP, sanction letter acceptance).
 * Prefer proxy headers, then Express `req.ip` (requires `trust proxy`).
 *
 * Note: In local Docker without an edge proxy, this may still be a bridge
 * address (e.g. `172.18.0.1`) — that is the Docker gateway, not the borrower.
 */
export function readClientIp(req: Request): string | undefined {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    const first = normalizeClientIp(xf.split(',')[0]);
    if (first) return first;
  }
  if (Array.isArray(xf) && xf[0]) {
    const first = normalizeClientIp(xf[0].split(',')[0]);
    if (first) return first;
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) {
    const normalized = normalizeClientIp(realIp);
    if (normalized) return normalized;
  }

  return normalizeClientIp(req.ip);
}
