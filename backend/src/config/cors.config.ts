import { DEFAULT_CORS_ORIGINS } from '../common/constants/app.constants';

export function getCorsOrigins() {
  const configuredOrigins = (process.env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS.join(','))
    .split(',')
    .map((origin: string) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set<string>(configuredOrigins));
}

function normalizeHostname(hostname: string) {
  return hostname.trim().replace(/^\[|\]$/g, '').toLowerCase();
}

function isPrivateNetworkHost(hostname: string) {
  const normalizedHostname = normalizeHostname(hostname);

  return /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/.test(
    normalizedHostname,
  );
}

function isLocalDevelopmentHost(hostname: string) {
  const normalizedHostname = normalizeHostname(hostname);

  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname === '127.0.0.1' ||
    normalizedHostname === '::1' ||
    isPrivateNetworkHost(normalizedHostname)
  );
}

function isDevelopmentEnvironment() {
  return (process.env.NODE_ENV ?? '').toLowerCase() !== 'production';
}

function getOriginPort(url: URL) {
  if (url.port) {
    return url.port;
  }

  if (url.protocol === 'https:') {
    return '443';
  }

  if (url.protocol === 'http:') {
    return '80';
  }

  return '';
}

function normalizeOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return origin.trim();
  }
}

function isConfiguredOrigin(origin: string, allowedOrigins: string[]) {
  const normalizedOrigin = normalizeOrigin(origin);
  return allowedOrigins.some((allowedOrigin) => normalizeOrigin(allowedOrigin) === normalizedOrigin);
}

function getAllowedDevPorts(allowedOrigins: string[]) {
  const ports = allowedOrigins
    .map((origin) => {
      try {
        const url = new URL(origin);
        return isLocalDevelopmentHost(url.hostname) ? getOriginPort(url) : null;
      } catch {
        return null;
      }
    })
    .filter((port): port is string => Boolean(port));

  return new Set(ports);
}

function isAllowedDevOrigin(origin: string, allowedOrigins: string[]) {
  try {
    const url = new URL(origin);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    if (!isLocalDevelopmentHost(url.hostname)) {
      return false;
    }

    if (isDevelopmentEnvironment()) {
      return true;
    }

    const allowedDevPorts = getAllowedDevPorts(allowedOrigins);

    return allowedDevPorts.has(getOriginPort(url));
  } catch {
    return false;
  }
}

export function createCorsOriginMatcher() {
  const allowedOrigins = getCorsOrigins();

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      // #region agent log
      fetch('http://127.0.0.1:7639/ingest/a8665698-2866-40f5-889d-a7ac7451a90b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ec50e'},body:JSON.stringify({sessionId:'1ec50e',runId:'pre-fix',hypothesisId:'H2',location:'backend/src/config/cors.config.ts:113',message:'CORS check without origin header',data:{allowedOrigins},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      callback(null, true);
      return;
    }

    if (isConfiguredOrigin(origin, allowedOrigins) || isAllowedDevOrigin(origin, allowedOrigins)) {
      // #region agent log
      fetch('http://127.0.0.1:7639/ingest/a8665698-2866-40f5-889d-a7ac7451a90b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ec50e'},body:JSON.stringify({sessionId:'1ec50e',runId:'pre-fix',hypothesisId:'H2',location:'backend/src/config/cors.config.ts:120',message:'CORS origin allowed',data:{origin,allowedOrigins},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      callback(null, true);
      return;
    }

    // #region agent log
    fetch('http://127.0.0.1:7639/ingest/a8665698-2866-40f5-889d-a7ac7451a90b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ec50e'},body:JSON.stringify({sessionId:'1ec50e',runId:'pre-fix',hypothesisId:'H2',location:'backend/src/config/cors.config.ts:126',message:'CORS origin blocked',data:{origin,allowedOrigins},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    callback(new Error(`CORS blocked for origin: ${origin}`), false);
  };
}
