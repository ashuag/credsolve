/**
 * Application-layer WAF: inspect URL, query, and selected headers for common
 * exploit payloads. Body scanning is limited (JSON only, size-capped) so KYC
 * image base64 / bureau payloads are not false-positive blocked.
 */

export const WAF_BLOCKED_CODE = 'WAF_BLOCKED';

export type WafHit = {
  ruleId: string;
  field: 'url' | 'query' | 'header' | 'body';
  detail: string;
};

export type WafInspectInput = {
  method: string;
  originalUrl: string;
  queryString?: string;
  headers: Record<string, string | string[] | undefined>;
  /** Already-parsed JSON body; skipped when too large or non-object. */
  body?: unknown;
};

type CompiledRule = {
  id: string;
  field: WafHit['field'];
  pattern: RegExp;
  description: string;
};

/** Patterns applied to URL path + query (decoded). */
const URL_RULES: CompiledRule[] = [
  {
    id: 'path-traversal',
    field: 'url',
    pattern: /(?:\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.%2e\/|%2e\.\/)/i,
    description: 'Path traversal',
  },
  {
    id: 'null-byte',
    field: 'url',
    pattern: /%00|\x00/i,
    description: 'Null byte',
  },
  {
    id: 'sql-injection',
    field: 'url',
    pattern:
      /(?:'\s*or\s+'?\d|'\s*or\s+''\s*=|union\s+select|sleep\s*\(|benchmark\s*\(|information_schema|xp_cmdshell|;\s*drop\s+table|;\s*truncate\s+)/i,
    description: 'SQL injection',
  },
  {
    id: 'xss',
    field: 'url',
    pattern:
      /(?:<script[\s>]|javascript\s*:|onerror\s*=|onload\s*=|onfocus\s*=|<\s*iframe|<\s*object|<\s*embed|<\s*svg[\s>][^>]*on\w+\s*=)/i,
    description: 'Cross-site scripting',
  },
  {
    id: 'command-injection',
    field: 'url',
    pattern: /(?:;|\||`|\$\()\s*(?:cat|wget|curl|bash|sh|cmd|powershell)\b/i,
    description: 'Command injection',
  },
  {
    id: 'prototype-pollution',
    field: 'url',
    pattern: /(?:__proto__|constructor\s*\[|prototype\s*\[)/i,
    description: 'Prototype pollution',
  },
];

const HEADER_RULES: CompiledRule[] = [
  {
    id: 'header-crlf',
    field: 'header',
    pattern: /[\r\n]/,
    description: 'Header CRLF injection',
  },
  {
    id: 'header-xss',
    field: 'header',
    pattern: /<script[\s>]|javascript\s*:/i,
    description: 'Script payload in header',
  },
];

const BODY_RULES: CompiledRule[] = [
  {
    id: 'body-sql-injection',
    field: 'body',
    pattern:
      /(?:union\s+select|sleep\s*\(|benchmark\s*\(|information_schema|;\s*drop\s+table|xp_cmdshell)/i,
    description: 'SQL injection in body',
  },
  {
    id: 'body-xss',
    field: 'body',
    pattern: /<script[\s>]|javascript\s*:/i,
    description: 'XSS in body',
  },
  {
    id: 'body-prototype-pollution',
    field: 'body',
    pattern: /"__proto__"\s*:|"constructor"\s*:\s*\{\s*"prototype"/i,
    description: 'Prototype pollution in body',
  },
];

const INSPECTED_HEADERS = [
  'user-agent',
  'referer',
  'origin',
  'x-forwarded-for',
  'x-real-ip',
  'x-original-url',
  'x-rewrite-url',
] as const;

/** Skip body WAF for upload-heavy routes (base64 / multipart JSON fields). */
const BODY_SCAN_SKIP_PATH_PREFIXES = [
  '/api/auth/kyc',
  '/api/auth/applications',
  '/api/los/developer-tools',
  '/api/los/applications',
  '/api/bureau',
];

const MAX_BODY_SCAN_CHARS = 32_768;

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(',');
  return value ?? '';
}

function decodeSafely(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

function matchRules(text: string, rules: CompiledRule[]): WafHit | null {
  if (!text) return null;
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      return { ruleId: rule.id, field: rule.field, detail: rule.description };
    }
  }
  return null;
}

function flattenBodyStrings(value: unknown, out: string[], depth = 0): void {
  if (out.join('').length >= MAX_BODY_SCAN_CHARS || depth > 6) return;
  if (typeof value === 'string') {
    // Skip long base64 / data-URL blobs (selfies, docs).
    if (value.length > 512 && (/^[A-Za-z0-9+/=\s]+$/.test(value) || value.startsWith('data:'))) {
      return;
    }
    out.push(value.slice(0, 2_048));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenBodyStrings(item, out, depth + 1);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (/__proto__|constructor|prototype/i.test(key)) {
        out.push(key);
      }
      flattenBodyStrings(child, out, depth + 1);
    }
  }
}

function shouldSkipBodyScan(originalUrl: string): boolean {
  const path = originalUrl.split('?')[0] ?? originalUrl;
  return BODY_SCAN_SKIP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Returns the first WAF hit, or null when the request looks clean.
 */
export function inspectRequestForWaf(input: WafInspectInput): WafHit | null {
  const urlDecoded = decodeSafely(input.originalUrl);
  const urlHit = matchRules(urlDecoded, URL_RULES);
  if (urlHit) return urlHit;

  if (input.queryString) {
    const queryHit = matchRules(decodeSafely(input.queryString), URL_RULES.map((r) => ({ ...r, field: 'query' as const })));
    if (queryHit) return queryHit;
  }

  for (const name of INSPECTED_HEADERS) {
    const raw = headerValue(input.headers[name]);
    if (!raw) continue;
    const hit = matchRules(raw, HEADER_RULES);
    if (hit) {
      return { ...hit, detail: `${hit.detail} (${name})` };
    }
  }

  if (input.body != null && !shouldSkipBodyScan(input.originalUrl)) {
    const parts: string[] = [];
    flattenBodyStrings(input.body, parts);
    const bodyText = parts.join('\n').slice(0, MAX_BODY_SCAN_CHARS);
    const bodyHit = matchRules(bodyText, BODY_RULES);
    if (bodyHit) return bodyHit;
  }

  return null;
}

export function isWafEnabled(envValue: string | undefined): boolean {
  const raw = (envValue ?? '').trim().toLowerCase();
  if (!raw) return true; // on by default
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

export function isWafBlockMode(envValue: string | undefined): boolean {
  const raw = (envValue ?? 'block').trim().toLowerCase();
  return raw !== 'log' && raw !== 'observe' && raw !== 'dry-run';
}
