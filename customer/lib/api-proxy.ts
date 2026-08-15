import { NextRequest, NextResponse } from 'next/server';
import { getCustomerServerApiBase } from './nest-api-base';

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
 * Response headers that must NOT be forwarded. Node's `fetch` (undici) transparently
 * decodes the upstream body when we re-stream `upstream.body`, so the original
 * `content-encoding` (gzip/br) no longer matches the bytes we forward — leaving it in
 * makes the browser try to decompress plain JSON and fail with "Failed to fetch" while
 * reading the body (e.g. a compressed `GET /auth/me` looked like `{ authenticated:false }`).
 * `content-length` is dropped for the same reason (decoded length differs); the platform
 * re-adds the correct framing.
 */
const RESPONSE_STRIP_HEADERS = new Set(['content-encoding', 'content-length']);

const PROXY_TIMEOUT_MS = 60_000;
/** First-time KFS HTML→PDF (Puppeteer) can exceed the default API budget. */
const LOAN_DOCUMENT_PDF_PROXY_TIMEOUT_MS = 90_000;

function buildUpstreamUrl(pathSegments: string[], search: string): string {
  const base = getCustomerServerApiBase().replace(/\/$/, '');
  const suffix = pathSegments.map(encodeURIComponent).join('/');
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

  // Ensure Nest sees the browser IP (not the customer→backend Docker hop).
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const clientIp =
    (forwarded?.split(',')[0]?.trim() || realIp?.trim() || request.headers.get('cf-connecting-ip')?.trim() || '')
      .replace(/^::ffff:/i, '');

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

export async function proxyCustomerApiRequest(
  request: NextRequest,
  pathSegments: string[]
): Promise<NextResponse> {
  const upstreamUrl = buildUpstreamUrl(pathSegments, request.nextUrl.search);
  const method = request.method.toUpperCase();

  const isLoanDocumentPdf = /\/loan-documents\/[^/]+\/pdf(?:\?|$)/i.test(upstreamUrl);
  const init: RequestInit = {
    method,
    headers: forwardRequestHeaders(request),
    redirect: 'manual',
    signal: AbortSignal.timeout(isLoanDocumentPdf ? LOAN_DOCUMENT_PDF_PROXY_TIMEOUT_MS : PROXY_TIMEOUT_MS),
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (err) {
    console.error(`[customer/api-proxy] ${method} ${upstreamUrl} failed`, err);
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
