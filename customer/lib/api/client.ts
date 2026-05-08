import { getApiUrl } from '../api-url';

/**
 * Default per-request timeouts (ms). GETs should fail fast so the user can retry;
 * mutations (POST etc.) get a longer budget but still well under any UX-blocking limit.
 * Override with `NEXT_PUBLIC_API_FETCH_TIMEOUT_MS` (applies to both) or the more
 * specific `NEXT_PUBLIC_API_GET_TIMEOUT_MS` / `NEXT_PUBLIC_API_POST_TIMEOUT_MS`.
 */
const DEFAULT_GET_TIMEOUT_MS = 10_000;
const DEFAULT_POST_TIMEOUT_MS = 15_000;

function readTimeoutMs(envValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(envValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SHARED_TIMEOUT_MS = readTimeoutMs(process.env.NEXT_PUBLIC_API_FETCH_TIMEOUT_MS, NaN);
const GET_TIMEOUT_MS = Number.isFinite(SHARED_TIMEOUT_MS)
  ? (SHARED_TIMEOUT_MS as number)
  : readTimeoutMs(process.env.NEXT_PUBLIC_API_GET_TIMEOUT_MS, DEFAULT_GET_TIMEOUT_MS);
const POST_TIMEOUT_MS = Number.isFinite(SHARED_TIMEOUT_MS)
  ? (SHARED_TIMEOUT_MS as number)
  : readTimeoutMs(process.env.NEXT_PUBLIC_API_POST_TIMEOUT_MS, DEFAULT_POST_TIMEOUT_MS);

type ApiErrorShape = {
  message?: string | string[] | Record<string, unknown>;
  error?: string;
  statusCode?: number;
};

/** Thrown when the API returns a non-2xx response (e.g. Nest `HttpException` / validation errors). */
export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly body: unknown;

  constructor(message: string, statusCode: number, body: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

/**
 * Client-side failure that never reached (or never returned from) the server: timeout,
 * network error, or aborted by the caller. `statusCode` is always 0 so existing
 * `instanceof ApiRequestError && statusCode === 4xx/5xx` checks never match these.
 */
export class ApiClientError extends ApiRequestError {
  readonly kind: 'timeout' | 'network' | 'aborted' | 'unknown';

  constructor(message: string, kind: ApiClientError['kind']) {
    super(message, 0, null);
    this.name = 'ApiClientError';
    this.kind = kind;
  }
}

const TIMEOUT_USER_MESSAGE = 'The request took too long. Please check your connection and try again.';
const NETWORK_USER_MESSAGE = "Couldn't reach the server. Please check your connection and try again.";

function classifyFetchError(err: unknown): ApiClientError {
  // AbortSignal.timeout(...) throws DOMException('TimeoutError') on Firefox/Chrome.
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    if (err.name === 'TimeoutError') {
      return new ApiClientError(TIMEOUT_USER_MESSAGE, 'timeout');
    }
    if (err.name === 'AbortError') {
      return new ApiClientError(TIMEOUT_USER_MESSAGE, 'aborted');
    }
  }

  // Some runtimes report timeouts/aborts as plain Errors with these names.
  if (err instanceof Error) {
    if (err.name === 'TimeoutError') {
      return new ApiClientError(TIMEOUT_USER_MESSAGE, 'timeout');
    }
    if (err.name === 'AbortError') {
      return new ApiClientError(TIMEOUT_USER_MESSAGE, 'aborted');
    }
    // `fetch` rejects with TypeError for network-layer failures (DNS, TLS, offline, CORS-blocked).
    if (err instanceof TypeError) {
      return new ApiClientError(NETWORK_USER_MESSAGE, 'network');
    }
  }

  return new ApiClientError(NETWORK_USER_MESSAGE, 'unknown');
}

function extractErrorMessage(data: unknown, fallbackMessage: string): string {
  const error = data as ApiErrorShape | null;

  if (Array.isArray(error?.message)) {
    return error.message[0] ?? fallbackMessage;
  }

  if (typeof error?.message === 'string') {
    return error.message;
  }

  /** Nest `ValidationPipe` can return messages keyed by field. */
  if (error?.message && typeof error.message === 'object') {
    const first = Object.values(error.message).flat()[0];
    if (typeof first === 'string') {
      return first;
    }
  }

  if (typeof error?.error === 'string' && error.error.trim()) {
    return error.error;
  }

  return fallbackMessage;
}

async function fetchOnce<T>(
  requestUrl: string,
  init: RequestInit,
  timeoutMs: number,
  fallbackMessage: string
): Promise<T | null> {
  // Combine caller-provided signal with our timeout signal so both can abort.
  const callerSignal = init.signal;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal =
    callerSignal && typeof (AbortSignal as { any?: unknown }).any === 'function'
      ? AbortSignal.any([callerSignal, timeoutSignal])
      : (callerSignal ?? timeoutSignal);

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      credentials: 'include',
      ...init,
      signal,
    });
  } catch (err) {
    // If the caller's own signal aborted, surface that as an aborted client error
    // (still a clean message, but distinct kind so callers can ignore it if they want).
    if (callerSignal?.aborted) {
      throw new ApiClientError(TIMEOUT_USER_MESSAGE, 'aborted');
    }
    throw classifyFetchError(err);
  }

  const data = (await response.json().catch(() => null)) as T | ApiErrorShape | null;

  if (!response.ok) {
    const message = extractErrorMessage(data, fallbackMessage);
    throw new ApiRequestError(message, response.status, data);
  }

  return (data as T | null) ?? null;
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  fallbackMessage: string,
  options: { timeoutMs: number; retryOnTransient: boolean }
): Promise<T | null> {
  const requestUrl = `${getApiUrl()}${path}`;

  try {
    return await fetchOnce<T>(requestUrl, init, options.timeoutMs, fallbackMessage);
  } catch (err) {
    const isTransient =
      err instanceof ApiClientError && (err.kind === 'timeout' || err.kind === 'network');
    // Don't retry if the caller-provided signal aborted -- that intent must be respected.
    const callerAborted = init.signal?.aborted === true;
    if (!options.retryOnTransient || !isTransient || callerAborted) {
      throw err;
    }
    return await fetchOnce<T>(requestUrl, init, options.timeoutMs, fallbackMessage);
  }
}

export async function apiGet<T>(
  path: string,
  fallbackMessage: string,
  init?: Omit<RequestInit, 'method'>
): Promise<T | null> {
  return requestJson<T>(
    path,
    {
      method: 'GET',
      cache: 'no-store',
      ...init,
    },
    fallbackMessage,
    { timeoutMs: GET_TIMEOUT_MS, retryOnTransient: true }
  );
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  fallbackMessage: string,
  init?: Omit<RequestInit, 'method' | 'body'>
): Promise<T | null> {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return requestJson<T>(
    path,
    {
      ...init,
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    fallbackMessage,
    { timeoutMs: POST_TIMEOUT_MS, retryOnTransient: false }
  );
}

export async function apiPostFormData<T>(
  path: string,
  formData: FormData,
  fallbackMessage: string,
  init?: Omit<RequestInit, 'method' | 'body'>
): Promise<T | null> {
  return requestJson<T>(
    path,
    {
      ...init,
      method: 'POST',
      body: formData,
    },
    fallbackMessage,
    { timeoutMs: POST_TIMEOUT_MS, retryOnTransient: false }
  );
}
