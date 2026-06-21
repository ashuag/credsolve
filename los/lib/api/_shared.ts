/**
 * Internal helpers for the LOS API client. NOT re-exported from
 * `@/lib/api` — keep these private to the api/ folder so consumers of
 * the public surface can't reach into transport plumbing.
 */
import { buildLosApiUrl, getLosClientApiBase, getLosServerApiBase } from '../api-env';
import { LOS_COOKIE_NAME, LOS_STORAGE_KEY } from '../auth';

export const API_URL = getLosServerApiBase();
export const SERVER_REVALIDATE_SECONDS = 30;
export const CLIENT_READ_CACHE_TTL_MS = 30_000;
const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/** Bounded wait so hung API calls do not leave UI pending forever. */
export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const signal = init?.signal ?? AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS);
  return fetch(input, { ...init, signal });
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
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const response = await fetchWithTimeout(resolveLosClientApiUrl(path), {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
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
