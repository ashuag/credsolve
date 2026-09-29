/**
 * Internal helpers for the LOS API client. NOT re-exported from
 * `@/lib/api` — keep these private to the api/ folder so consumers of
 * the public surface can't reach into transport plumbing.
 *
 * Do not call `getLosServerApiBase()` at module load. This file is pulled
 * into client components via `@/lib/api`; `API_SERVER_URL` is server-only
 * and a top-level call falls back to `NEXT_PUBLIC_API_URL=/api/los` and throws.
 */
import { buildLosApiUrl, getLosClientApiBase } from '../api-env';
import { LOS_COOKIE_NAME, LOS_STORAGE_KEY } from '../auth';

export const SERVER_REVALIDATE_SECONDS = 30;
export const CLIENT_READ_CACHE_TTL_MS = 30_000;
const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
/** Workbook downloads parse stored CIBIL JSON and can exceed the default read timeout. */
export const WORKBOOK_DOWNLOAD_TIMEOUT_MS = 120_000;

/** Bounded wait so hung API calls do not leave UI pending forever. */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const signal = init?.signal ?? AbortSignal.timeout(timeoutMs);
  return fetch(input, { ...init, signal });
}

export function isFetchTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === 'TimeoutError' ||
    err.name === 'AbortError' ||
    /aborted|timeout/i.test(err.message)
  );
}

/** Builds a query string from a filters/params object — same keys as the table's active column filters, blank/nullish values dropped. Used by every filtered-list and filtered-export endpoint (Loans, Leads, Applications, Vendor API Logs, the LOS Reports dumps). */
export function buildExportFilterParams(filters: Partial<Record<string, string | number>>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) params.set(key, text);
  }
  return params;
}

/** Reads a filename out of a `Content-Disposition: attachment; filename="…"` (or RFC 5987 `filename*=`) header. */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) return decodeURIComponent(utf8[1].trim());
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const plain = /filename=([^;]+)/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

/**
 * Authenticated workbook download shared by every LOS Reports dump (Bureau Report, Lead Report,
 * Transaction Report): fetches `path` with the token as a Bearer header (not a query token) and the
 * table's active column filters as query params, then saves the response blob under the filename
 * the server names in `Content-Disposition` (falling back to `fallbackFilename`).
 */
export async function downloadAuthenticatedWorkbook(options: {
  token: string;
  path: string;
  filters: Partial<Record<string, string>>;
  timeoutMessage: string;
  fallbackErrorMessage: string;
  fallbackFilename: string;
}): Promise<void> {
  const { token, path, filters, timeoutMessage, fallbackErrorMessage, fallbackFilename } = options;
  const params = buildExportFilterParams(filters);
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${resolveLosClientApiUrl(path)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } },
      WORKBOOK_DOWNLOAD_TIMEOUT_MS,
    );
  } catch (err) {
    if (isFetchTimeoutError(err)) {
      throw new Error(timeoutMessage);
    }
    throw err;
  }

  if (!response.ok) {
    const body = await parseJsonResponse(response);
    if (response.status === 401) {
      throw new Error('Session expired — please log in again.');
    }
    throw new Error(messageFromBody(body) ?? fallbackErrorMessage);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFromContentDisposition(response.headers.get('Content-Disposition')) ?? fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function clientApiUrl() {
  return getLosClientApiBase();
}

export function resolveLosClientApiUrl(path: string): string {
  return buildLosApiUrl(getLosClientApiBase(), path);
}

export async function parseJsonResponse(response: Response) {
  return response.json().catch(() => null) as Promise<unknown>;
}

export function messageFromBody(body: unknown) {
  return typeof body === 'object' && body !== null && 'message' in body
    ? (body as { message?: string }).message
    : undefined;
}

function handleUnauthorized() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LOS_STORAGE_KEY);
  document.cookie = `${LOS_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  window.location.href = '/login';
}

type ClientReadCacheEntry = {
  expiresAt: number;
  data: unknown;
};

const clientReadCache = new Map<string, ClientReadCacheEntry>();
const clientReadInFlight = new Map<string, Promise<unknown>>();

function clientReadCacheKey(token: string, path: string) {
  return `${token}:${path}`;
}

export function invalidateClientReadCache() {
  clientReadCache.clear();
  clientReadInFlight.clear();
}

/**
 * GET wrapper that:
 *  - caches successful responses for `CLIENT_READ_CACHE_TTL_MS`
 *  - coalesces concurrent calls for the same key (no thundering herd)
 *  - throws with a server-provided message when the response is not ok.
 */
export async function cachedAuthorizedLosGet<T>(
  token: string,
  path: string,
  fallbackMessage: string,
): Promise<T> {
  const key = clientReadCacheKey(token, path);
  const now = Date.now();
  const cached = clientReadCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  const inflight = clientReadInFlight.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const request = (async () => {
    const response = await fetchWithTimeout(resolveLosClientApiUrl(path), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const body = await parseJsonResponse(response);

    if (!response.ok) {
      if (response.status === 401) handleUnauthorized();
      throw new Error(messageFromBody(body) ?? fallbackMessage);
    }

    clientReadCache.set(key, {
      expiresAt: Date.now() + CLIENT_READ_CACHE_TTL_MS,
      data: body,
    });

    return body as T;
  })();

  clientReadInFlight.set(key, request);

  try {
    return await request;
  } finally {
    clientReadInFlight.delete(key);
  }
}

/**
 * Authenticated request wrapper used by mutation endpoints.
 * Automatically invalidates the client read cache on non-GET methods
 * so subsequent reads see fresh data.
 */
export async function authorizedLosRequest<T>(
  token: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string,
  timeoutMs?: number,
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const response = await fetchWithTimeout(
    resolveLosClientApiUrl(path),
    {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    },
    timeoutMs,
  );
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized();
    throw new Error(messageFromBody(body) ?? fallbackMessage);
  }

  if (method !== 'GET' && method !== 'HEAD') {
    invalidateClientReadCache();
  }

  return body as unknown as T;
}
