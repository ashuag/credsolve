import { getApiUrl } from '../api-url';

type ApiErrorShape = {
  message?: string | string[];
};

function extractErrorMessage(data: unknown, fallbackMessage: string) {
  const error = data as ApiErrorShape | null;

  if (Array.isArray(error?.message)) {
    return error.message[0];
  }

  return error?.message ?? fallbackMessage;
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
    throw new Error(extractErrorMessage(data, fallbackMessage));
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
