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
  // #region agent log
  fetch('http://127.0.0.1:7639/ingest/a8665698-2866-40f5-889d-a7ac7451a90b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ec50e'},body:JSON.stringify({sessionId:'1ec50e',runId:'frontend-debug',hypothesisId:'F1',location:'customer/lib/api/client.ts:25',message:'API request start',data:{path,requestUrl,method:init.method ?? 'GET'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  console.log('[agent-debug][F1] api request start', {
    path,
    requestUrl,
    method: init.method ?? 'GET',
  });
  const response = await fetch(requestUrl, {
    credentials: 'include',
    ...init
  });

  const data = (await response.json().catch(() => null)) as T | ApiErrorShape | null;
  // #region agent log
  fetch('http://127.0.0.1:7639/ingest/a8665698-2866-40f5-889d-a7ac7451a90b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ec50e'},body:JSON.stringify({sessionId:'1ec50e',runId:'frontend-debug',hypothesisId:'F2',location:'customer/lib/api/client.ts:33',message:'API response received',data:{path,requestUrl,status:response.status,ok:response.ok,hasMessage:Boolean((data as ApiErrorShape | null)?.message)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  console.log('[agent-debug][F2] api response received', {
    path,
    requestUrl,
    status: response.status,
    ok: response.ok,
    hasMessage: Boolean((data as ApiErrorShape | null)?.message),
  });

  if (!response.ok) {
    // #region agent log
    fetch('http://127.0.0.1:7639/ingest/a8665698-2866-40f5-889d-a7ac7451a90b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ec50e'},body:JSON.stringify({sessionId:'1ec50e',runId:'frontend-debug',hypothesisId:'F2',location:'customer/lib/api/client.ts:37',message:'API response not ok',data:{path,requestUrl,status:response.status,errorMessage:extractErrorMessage(data, fallbackMessage)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.log('[agent-debug][F2] api response not ok', {
      path,
      requestUrl,
      status: response.status,
      errorMessage: extractErrorMessage(data, fallbackMessage),
    });
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
