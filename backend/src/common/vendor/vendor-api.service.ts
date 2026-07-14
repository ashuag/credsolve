import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { VendorHttpMethod } from '../constants/vendor-http-method.constants';
import { isVendorApi5xxFailure } from './vendor-api-error.util';
import { VendorInternalErrorService } from './vendor-internal-error.service';

/** Default per-request timeout. Long enough for most KYC vendors, short enough that hung calls don't pile up. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Cap on stored response body size, in characters. Vendor APIs can return
 * megabytes of debug data on errors; we don't want a single failure to fill
 * the audit table. Anything larger gets truncated with metadata.
 */
const MAX_LOGGED_RESPONSE_CHARS = 64_000;

/**
 * Header names whose values are masked before they hit the audit log or
 * stderr. The lookup is case-insensitive. Values are replaced with
 * `[REDACTED:N chars]` so we can still confirm "yes, the header was set
 * with N characters" — useful for catching missing-env-var bugs without
 * leaking secrets.
 */
const SENSITIVE_HEADER_NAMES: ReadonlySet<string> = new Set([
  'authorization',
  'wire-api-key',
  'x-api-key',
  'api-key',
  'apikey',
  'client-id',
  'cookie',
  'set-cookie',
  'x-auth-token',
  'proxy-authorization',
]);

/** Short snippet of the response body included in failure logs to aid debugging. */
const FAILURE_LOG_BODY_SNIPPET_CHARS = 500;

/** MySQL `TEXT` upper bound; caps `vendor_api_log.request_path` if URL is pathological. */
const MAX_REQUEST_PATH_AUDIT_CHARS = 65_535;

export type VendorApiCallOptions<TBody = unknown> = {
  /** Logical vendor name (audit), e.g. `'Tenacio'`. */
  providerName: string;
  /** Logical service identifier (audit), e.g. `'pan-name-dob'`. */
  serviceName: string;
  method: VendorHttpMethod;
  /**
   * Provider base URL, e.g. `https://testapi.tenacio.io/api/v1/services`.
   * Ignored when `absoluteUrl` is set.
   */
  baseUrl?: string;
  /**
   * Path appended to `baseUrl`, e.g. `pan-name-dob`. Ignored when `absoluteUrl` is set.
   */
  path?: string;
  /**
   * Full outbound URL (scheme + host + path + optional query). When set, `baseUrl` and `path` are not used.
   * Use when the bureau endpoint does not compose cleanly from `VENDOR_HOST` + slug.
   */
  absoluteUrl?: string;
  /** Extra headers (auth, vendor-specific). `Content-Type: application/json` is set automatically when sending a body. */
  headers?: Record<string, string>;
  /** Request body. Serialised to JSON for non-GET/DELETE methods. */
  body?: TBody;
  /** Optional FK linking this call to a lead, for cross-table joins on the audit log. */
  leadId?: bigint | null;
  /** Override the default request timeout (ms). */
  timeoutMs?: number;
  /**
   * Sanitises the body before it lands in the audit table. Use this to mask
   * PII (PAN numbers, mobile, etc.) at the source rather than relying on
   * downstream consumers to redact. Defaults to logging the body verbatim.
   */
  redactRequest?: (body: TBody | undefined) => unknown;
  /** Extra header names to redact in audit logs (case-insensitive). */
  sensitiveHeaderNames?: string[];
};

export type VendorApiCallResult<TResponse> = {
  /** True when the response was 2xx. False on non-2xx, network errors, or timeouts. */
  ok: boolean;
  /** HTTP status code, or `null` if the call failed before a response was received. */
  httpStatus: number | null;
  /** Parsed JSON response, or `null` if empty/non-JSON/error. */
  body: TResponse | null;
  /** Raw response text when the HTTP body was non-empty (including non-JSON error pages). */
  rawText?: string;
  /** Set when the call threw (network/timeout/abort). 2xx + non-2xx HTTP responses do NOT set this. */
  error?: Error;
};

/**
 * Generic 3rd-party API caller with audit logging.
 *
 * Every call writes one row to `vendor_api_log` (success or failure), so you
 * have a complete trail of vendor traffic with timings, payloads, and status
 * codes. Audit writes are best-effort: a failure to persist the log row will
 * NOT fail the upstream API call.
 *
 * Designed to be the low-level primitive that domain-specific clients
 * (e.g. `TenacioClientService`) compose on top of. Keep this thin — vendor
 * quirks belong in the domain client, not here.
 *
 * Example:
 * ```ts
 * const result = await this.vendorApi.request({
 *   providerName: 'Tenacio',
 *   serviceName: 'pan-name-dob',
 *   method: 'POST',
 *   baseUrl: process.env.VENDOR_HOST!,
 *   path: 'pan-name-dob',
 *   headers: {
 *     'client-id': process.env.TENACIO_CLIENT_ID!,
 *     'x-api-key': process.env.TENACIO_API_KEY!,
 *   },
 *   body: { input: { panNumber, consent: true } },
 *   leadId: lead.id,
 * });
 * // Or pass `absoluteUrl` instead of `baseUrl` + `path` for a fixed bureau URL.
 * if (!result.ok) { ... }
 * ```
 */
@Injectable()
export class VendorApiService {
  private readonly logger = new Logger(VendorApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly internalError: VendorInternalErrorService,
  ) {}

  async request<TResponse = unknown, TBody = unknown>(
    opts: VendorApiCallOptions<TBody>,
  ): Promise<VendorApiCallResult<TResponse>> {
    const requestedAt = new Date();
    const abs = opts.absoluteUrl?.trim();
    let url: string;
    let pathForLog: string;

    if (abs) {
      url = abs;
    } else {
      const base = (opts.baseUrl ?? '').trim();
      const path = opts.path ?? '';
      if (!base) {
        const err = new Error('VendorApiService.request: provide absoluteUrl or baseUrl');
        this.logger.error(`${opts.providerName}/${opts.serviceName}: ${err.message}`);
        return { ok: false, httpStatus: null, body: null, error: err };
      }
      url = joinBaseAndPath(base, path);
    }

    /** Full request URL for `vendor_api_log.request_path` (`TEXT` column). */
    const requestPathForAudit = url.slice(0, MAX_REQUEST_PATH_AUDIT_CHARS);
    pathForLog = requestPathForAudit;

    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const sendBody = opts.method !== 'GET' && opts.method !== 'DELETE' && opts.body !== undefined;

    // `Accept: application/json` is added for body-bearing calls because
    // several Indian fintech APIs (Tenacio included) return a "Header
    // validation error" when content negotiation isn't explicit. Caller
    // overrides win.
    const headers: Record<string, string> = sendBody
      ? { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers ?? {}) }
      : { Accept: 'application/json', ...(opts.headers ?? {}) };

    const redactedHeadersForAudit = redactHeaders(headers, opts.sensitiveHeaderNames);

    let httpStatus: number | null = null;
    let parsedResponse: TResponse | null = null;
    let rawText = '';
    let error: Error | undefined;

    try {
      const response = await fetch(url, {
        method: opts.method,
        headers,
        body: sendBody ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      httpStatus = response.status;
      rawText = await response.text();
      try {
        parsedResponse = rawText ? (JSON.parse(rawText) as TResponse) : null;
      } catch {
        // Non-JSON body: keep parsed=null; rawText is preserved in the audit row.
        parsedResponse = null;
      }
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      this.logger.warn(
        `${opts.providerName}/${opts.serviceName} ${opts.method} ${pathForLog} failed before response: ${error.message} headers=${JSON.stringify(redactedHeadersForAudit)}`,
      );
    }

    const respondedAt = new Date();
    const ok = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;

    // Surface non-2xx HTTP responses in stderr too — without this the
    // caller silently gets `ok: false` and the only trace is the audit row,
    // which is hard to find while debugging live integrations.
    if (!ok && httpStatus !== null) {
      const snippet = rawText ? rawText.slice(0, FAILURE_LOG_BODY_SNIPPET_CHARS) : '<empty>';
      this.logger.warn(
        `${opts.providerName}/${opts.serviceName} ${opts.method} ${pathForLog} HTTP ${httpStatus} headers=${JSON.stringify(redactedHeadersForAudit)} body=${snippet} url=${url}`,
      );
    }

    const requestForAudit = opts.redactRequest ? opts.redactRequest(opts.body) : (opts.body ?? null);
    const responseForAudit = buildResponseAuditPayload(rawText, parsedResponse, httpStatus);

    await this.persistAuditRow({
      providerName: opts.providerName,
      serviceName: opts.serviceName,
      requestMethod: opts.method,
      requestPath: requestPathForAudit,
      leadId: opts.leadId ?? null,
      requestHeaders: redactedHeadersForAudit,
      requestPayload: requestForAudit,
      responsePayload: responseForAudit,
      httpStatus,
      requestedAt,
      respondedAt,
    });

    if (opts.leadId != null) {
      if (isVendorApi5xxFailure({ httpStatus, body: parsedResponse })) {
        void this.internalError
          .handleVendor5xx({
            leadId: opts.leadId,
            providerName: opts.providerName,
            serviceName: opts.serviceName,
            httpStatus,
            body: parsedResponse,
            transportError: error?.message,
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `INTERNAL_ERROR escalation failed (${opts.providerName}/${opts.serviceName}, leadId=${opts.leadId?.toString()}): ${message}`,
            );
          });
      } else if (ok) {
        void this.internalError
          .maybeRecoverLeadAfterVendorSuccess({
            leadId: opts.leadId,
            providerName: opts.providerName,
            serviceName: opts.serviceName,
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `INTERNAL_ERROR recovery skipped (${opts.providerName}/${opts.serviceName}, leadId=${opts.leadId?.toString()}): ${message}`,
            );
          });
      }
    }

    return {
      ok,
      httpStatus,
      body: parsedResponse,
      rawText: rawText || undefined,
      error,
    };
  }

  /**
   * Persists a vendor_api_log row for outbound calls that do not go through {@link request}
   * (e.g. SMTP email via nodemailer). Best-effort — failures are logged, not thrown.
   */
  async auditOutboundCall(row: {
    providerName: string;
    serviceName: string;
    requestMethod: VendorHttpMethod;
    requestPath: string;
    leadId?: bigint | null;
    requestHeaders?: Record<string, string>;
    requestPayload: unknown;
    responsePayload?: unknown;
    httpStatus: number | null;
    requestedAt: Date;
    respondedAt: Date;
  }): Promise<void> {
    await this.persistAuditRow({
      providerName: row.providerName,
      serviceName: row.serviceName,
      requestMethod: row.requestMethod,
      requestPath: row.requestPath.slice(0, MAX_REQUEST_PATH_AUDIT_CHARS),
      leadId: row.leadId ?? null,
      requestHeaders: redactHeaders(row.requestHeaders ?? {}),
      requestPayload: row.requestPayload,
      responsePayload: row.responsePayload ?? null,
      httpStatus: row.httpStatus,
      requestedAt: row.requestedAt,
      respondedAt: row.respondedAt,
    });
  }

  private async persistAuditRow(row: {
    providerName: string;
    serviceName: string;
    requestMethod: VendorHttpMethod;
    requestPath: string;
    leadId: bigint | null;
    requestHeaders: Record<string, string>;
    requestPayload: unknown;
    responsePayload: unknown;
    httpStatus: number | null;
    requestedAt: Date;
    respondedAt: Date;
  }): Promise<void> {
    try {
      // The `as unknown as Prisma.VendorApiLogUncheckedCreateInput` cast is a
      // bridge until `prisma generate` is run after the
      // 20260513000000_vendor_api_log_request_headers migration — until then
      // the generated client types don't yet know about `requestPath` /
      // `requestHeaders`. Once you regenerate, this cast is structurally
      // redundant and can be removed.
      const data = {
        providerName: row.providerName,
        serviceName: row.serviceName,
        requestMethod: row.requestMethod,
        requestPath: row.requestPath,
        leadId: row.leadId,
        requestHeaders: toJsonInput(row.requestHeaders),
        requestPayload: toJsonInput(row.requestPayload),
        responsePayload: toNullableJsonInput(row.responsePayload),
        httpStatus: row.httpStatus,
        requestedAt: row.requestedAt,
        respondedAt: row.respondedAt,
      } as unknown as Prisma.VendorApiLogUncheckedCreateInput;

      await this.prisma.client.vendorApiLog.create({ data });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to persist vendor_api_log row (${row.providerName}/${row.serviceName}): ${message}`);
    }
  }
}

function joinBaseAndPath(base: string, path: string): string {
  const baseTrimmed = base.replace(/\/+$/, '');
  const pathTrimmed = path.replace(/^\/+/, '');
  return `${baseTrimmed}/${pathTrimmed}`;
}

/**
 * Replaces values of sensitive headers with `[REDACTED:N chars]` so we can
 * see "the header was set with N characters" without leaking the secret.
 * Header keys are preserved verbatim; the case-insensitive lookup only
 * decides redaction.
 */
function redactHeaders(
  headers: Record<string, string>,
  extraSensitiveNames?: string[],
): Record<string, string> {
  const sensitive = new Set(SENSITIVE_HEADER_NAMES);
  for (const name of extraSensitiveNames ?? []) {
    const trimmed = name.trim().toLowerCase();
    if (trimmed) sensitive.add(trimmed);
  }
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (sensitive.has(name.toLowerCase())) {
      out[name] = `[REDACTED:${value.length} chars]`;
    } else {
      out[name] = value;
    }
  }
  return out;
}

/**
 * Returns a payload safe to write to a `Json` column. Caps oversized
 * responses to keep audit rows from running away.
 */
function buildResponseAuditPayload(rawText: string, parsed: unknown, httpStatus: number | null): unknown {
  if (!rawText) {
    if (httpStatus != null && httpStatus >= 400) {
      return { _emptyBody: true, httpStatus };
    }
    return safeJsonForAudit(parsed ?? null);
  }
  if (rawText.length > MAX_LOGGED_RESPONSE_CHARS) {
    return safeJsonForAudit({
      _truncated: true,
      _originalSize: rawText.length,
      httpStatus,
      snippet: rawText.slice(0, MAX_LOGGED_RESPONSE_CHARS),
      ...(parsed != null ? { parsed } : {}),
    });
  }
  if (parsed != null) {
    return safeJsonForAudit(parsed);
  }
  return safeJsonForAudit({
    _unparsedBody: true,
    httpStatus,
    body: rawText,
  });
}

/** Ensures audit JSON is serializable for Prisma/MySQL (drops cycles, BigInt, etc.). */
function safeJsonForAudit(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return { _serializationFailed: true };
  }
}

/** Coerces unknown values to a Prisma `Json` (NOT NULL) input. */
function toJsonInput(value: unknown): Prisma.InputJsonValue {
  if (value === null || value === undefined) return {};
  return value as Prisma.InputJsonValue;
}

/** Coerces unknown values to a Prisma `Json?` (nullable) input. */
function toNullableJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}
