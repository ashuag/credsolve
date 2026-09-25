import { NextRequest, NextResponse } from 'next/server';

/** Nest uses global prefix `/api`; tolerate `API_SERVER_URL` without that suffix. */
function nestApiBase(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const noSlash = t.replace(/\/$/, '');
  return noSlash.endsWith('/api') ? noSlash : `${noSlash}/api`;
}

function trimTrailingSlashes(s: string | undefined): string | undefined {
  const t = s?.trim();
  if (!t) return undefined;
  return t.replace(/\/+$/, '');
}

function withHttpScheme(origin: string): string {
  const t = origin.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function loopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.startsWith('127.');
}

function hostOnlyLoopback(hostHeader: string): boolean {
  const hostname = hostHeader.split(':')[0]?.trim() ?? hostHeader;
  return loopbackHostname(hostname);
}

/** First segment of RFC 7239 Forwarded header. */
function parseForwardedHostProto(header: string | null): { host: string; proto?: string } | null {
  if (!header) return null;
  const first = header.split(',')[0]?.trim();
  if (!first) return null;
  let host: string | undefined;
  let proto: string | undefined;
  for (const part of first.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    let val = part.slice(eq + 1).trim().replace(/^"+|"+$/g, '');
    if (key === 'host') host = val;
    if (key === 'proto') proto = val;
  }
  if (!host) return null;
  return { host, proto };
}

/**
 * Public origin for absolute redirects. Next.js requires absolute URLs for `NextResponse.redirect`
 * (see https://nextjs.org/docs/messages/middleware-relative-urls). Prefer env / proxy headers so
 * `request.nextUrl.origin` is not `http://localhost:3041` behind misconfigured proxies.
 */
function resolvePublicOrigin(request: NextRequest): string {
  const fromEnv =
    trimTrailingSlashes(process.env.NEXT_PUBLIC_CUSTOMER_PUBLIC_URL) ||
    trimTrailingSlashes(process.env.CUSTOMER_PUBLIC_URL);
  if (fromEnv) {
    return withHttpScheme(fromEnv);
  }

  const xfProtoRaw = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const xfProto = xfProtoRaw === 'http' || xfProtoRaw === 'https' ? xfProtoRaw : undefined;

  const xfHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (xfHost && !hostOnlyLoopback(xfHost)) {
    const proto = xfProto ?? 'https';
    return `${proto}://${xfHost}`;
  }

  const fwd = parseForwardedHostProto(request.headers.get('forwarded'));
  if (fwd && !hostOnlyLoopback(fwd.host)) {
    const p =
      fwd.proto === 'http' || fwd.proto === 'https'
        ? fwd.proto
        : xfProto ?? 'https';
    return `${p}://${fwd.host}`;
  }

  const rawHost = request.headers.get('host')?.split(',')[0]?.trim();
  if (rawHost && !hostOnlyLoopback(rawHost)) {
    const fromUrl = request.nextUrl.protocol.replace(':', '');
    const proto =
      xfProto ?? (fromUrl === 'http' || fromUrl === 'https' ? fromUrl : 'https');
    return `${proto}://${rawHost}`;
  }

  return request.nextUrl.origin;
}

function buildGoogleErrorUrl(request: NextRequest, reason: string, httpStatus?: number): string {
  const origin = resolvePublicOrigin(request);
  const next = new URL('/auth/google/error', origin.endsWith('/') ? origin.slice(0, -1) : origin);
  next.searchParams.set('reason', reason);

  if (httpStatus !== undefined && Number.isFinite(httpStatus)) {
    next.searchParams.set('status', String(httpStatus));
  }

  const q = request.nextUrl.searchParams;
  const mode = q.get('mode');
  if (mode === 'login' || mode === 'register') {
    next.searchParams.set('mode', mode);
  }

  const leadId = q.get('leadId')?.trim();
  if (leadId) {
    next.searchParams.set('leadId', leadId);
  }

  return next.toString();
}

/**
 * Proxies Google OAuth start to Nest while forwarding the customer session cookie.
 * (Next config rewrites do not reliably attach browser cookies to upstream fetches.)
 */
export async function GET(request: NextRequest) {
  const apiBase = nestApiBase(process.env.API_SERVER_URL);
  if (!apiBase) {
    return NextResponse.redirect(buildGoogleErrorUrl(request, 'Customer server is missing API configuration.', 500));
  }

  const incoming = request.nextUrl;
  const upstream = `${apiBase}/auth/google/login${incoming.search}`;

  const upstreamRes = await fetch(upstream, {
    method: 'GET',
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });

  if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
    const location = upstreamRes.headers.get('location');
    if (location) {
      let target = location.trim();
      try {
        // Reject relative URLs — Next.js `redirect()` requires an absolute URL.
        new URL(target);
      } catch {
        target = new URL(target.startsWith('/') ? target : `/${target}`, resolvePublicOrigin(request)).toString();
      }
      return NextResponse.redirect(target, upstreamRes.status);
    }
  }

  const httpStatus = upstreamRes.status;
  let message = 'Unable to start Google login right now.';
  try {
    const json = (await upstreamRes.json()) as { message?: string | string[] };
    if (Array.isArray(json.message)) {
      message = json.message[0] ?? message;
    } else if (typeof json.message === 'string' && json.message.trim()) {
      message = json.message;
    }
  } catch {
    // keep fallback message
  }

  return NextResponse.redirect(buildGoogleErrorUrl(request, message, httpStatus));
}
