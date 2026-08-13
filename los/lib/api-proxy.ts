import { NextRequest, NextResponse } from 'next/server';
import { getLosServerApiBase } from './api-env';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

/**
 * Node's `fetch` (undici) decodes compressed upstream bodies when we re-stream
 * `upstream.body`, so forwarding `content-encoding` / `content-length` breaks the browser.
 */
const RESPONSE_STRIP_HEADERS = new Set(['content-encoding', 'content-length']);

const PROXY_TIMEOUT_MS = 60_000;

function buildUpstreamUrl(pathSegments: string[], search: string): string {
  const base = getLosServerApiBase().replace(/\/$/, '');
  // `/api/los/auth/login` → ['los','auth','login'] while base is `.../api/los`.
  let segments = pathSegments;
  if (base.endsWith('/api/los') && segments[0] === 'los') {
    segments = segments.slice(1);
  }
  const suffix = segments.map(encodeURIComponent).join('/');
  const url = suffix ? `${base}/${suffix}` : base;
  return search ? `${url}${search}` : url;
}

function forwardRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) {
      return;
    }
    headers.set(key, value);
  });

  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const clientIp = (
    forwarded?.split(',')[0]?.trim() ||
    realIp?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    ''
  ).replace(/^::ffff:/i, '');

  if (clientIp) {
    headers.set('x-forwarded-for', clientIp);
    headers.set('x-real-ip', clientIp);
  }

  return headers;
}

function forwardResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || RESPONSE_STRIP_HEADERS.has(lower) || lower === 'set-cookie') {
      return;
    }
    headers.set(key, value);
  });
  return headers;
}

/** Same-origin `/api/los/*` → Nest `/api/los/*` (browser never talks to :4001 directly). */
export async function proxyLosApiRequest(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const upstreamUrl = buildUpstreamUrl(pathSegments, request.nextUrl.search);
  const method = request.method.toUpperCase();

  const init: RequestInit = {
    method,
    headers: forwardRequestHeaders(request),
    redirect: 'manual',
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (err) {
    console.error(`[los/api-proxy] ${method} ${upstreamUrl} failed`, err);
    return NextResponse.json({ message: 'API unavailable' }, { status: 502 });
  }

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardResponseHeaders(upstream),
  });

  const setCookies = upstream.headers.getSetCookie();
  setCookies.forEach((cookie) => {
    response.headers.append('Set-Cookie', cookie);
  });

  return response;
}
