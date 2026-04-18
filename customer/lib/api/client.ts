import { getApiUrl } from '../api-url';

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

async function requestJson<T>(
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T | null> {
  const requestUrl = `${getApiUrl()}${path}`;
  const response = await fetch(requestUrl, {
    credentials: 'include',
    ...init
  });

  const data = (await response.json().catch(() => null)) as T | ApiErrorShape | null;

  if (!response.ok) {
    const message = extractErrorMessage(data, fallbackMessage);
    throw new ApiRequestError(message, response.status, data);
  }

  return (data as T | null) ?? null;
}

export async function apiGet<T>(
  path: string,
  fallbackMessage: string,
  init?: Omit<RequestInit, 'method'>
): Promise<T | null> {
  return requestJson<T>(path, {
    method: 'GET',
    cache: 'no-store',
    ...init
  }, fallbackMessage);
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

  return requestJson<T>(path, {
    ...init,
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  }, fallbackMessage);
}
