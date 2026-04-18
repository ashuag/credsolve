import { NextRequest, NextResponse } from 'next/server';

/** Nest uses global prefix `/api`; tolerate `API_SERVER_URL` without that suffix. */
function nestApiBase(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const noSlash = t.replace(/\/$/, '');
  return noSlash.endsWith('/api') ? noSlash : `${noSlash}/api`;
}

function buildGoogleErrorUrl(request: NextRequest, reason: string, httpStatus?: number): string {
  const incoming = new URL(request.url);
  const next = new URL('/auth/google/error', incoming.origin);
  next.searchParams.set('reason', reason);

  if (httpStatus !== undefined && Number.isFinite(httpStatus)) {
    next.searchParams.set('status', String(httpStatus));
  }

  const mode = incoming.searchParams.get('mode');
  if (mode === 'login' || mode === 'register') {
    next.searchParams.set('mode', mode);
  }

  const leadId = incoming.searchParams.get('leadId')?.trim();
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

  const incoming = new URL(request.url);
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
      return NextResponse.redirect(location, upstreamRes.status);
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
