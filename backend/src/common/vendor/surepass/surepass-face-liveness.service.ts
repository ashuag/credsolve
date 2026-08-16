import { Injectable, Logger } from '@nestjs/common';
import { VENDOR_HTTP_METHOD } from '../../constants/vendor-http-method.constants';
import { VendorApiService } from '../vendor-api.service';

/** Default Surepass face-liveness endpoint (override via `SUREPASS_FACE_LIVENESS_URL`). */
export const DEFAULT_SUREPASS_FACE_LIVENESS_URL = 'https://kyc-api.surepass.app/api/v1/face/face-liveness';

/** Response body snippet size for the console request/response log (full body still goes to `vendor_api_log`). */
const LOG_BODY_SNIPPET_CHARS = 1_000;

export type SurepassFaceLivenessFile = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
};

export type SurepassFaceLivenessInput = {
  /** Face image (or PDF when `usePdf` is set). Mutually exclusive with `link`. */
  file?: SurepassFaceLivenessFile;
  /** Public image URL. Mutually exclusive with `file`. */
  link?: string;
  usePdf?: boolean;
};

export type SurepassFaceLivenessResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
  error?: Error;
};

/**
 * Surepass face-liveness check (`POST /api/v1/face/face-liveness`, `multipart/form-data`).
 *
 * Env: `SUREPASS_TOKEN` (Bearer, required) and optional `SUREPASS_FACE_LIVENESS_URL`.
 * Sends `multipart/form-data`, so it bypasses `VendorApiService.request` (JSON/form-urlencoded
 * only) and calls `fetch` directly; the call is still audited via
 * `VendorApiService.auditOutboundCall` so it shows up in `vendor_api_log` like every other vendor call.
 */
@Injectable()
export class SurepassFaceLivenessService {
  private readonly logger = new Logger(SurepassFaceLivenessService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  async checkFaceLiveness(
    input: SurepassFaceLivenessInput,
    leadId: bigint | null,
  ): Promise<SurepassFaceLivenessResult> {
    const token = (process.env.SUREPASS_TOKEN ?? '').trim();
    const url = (process.env.SUREPASS_FACE_LIVENESS_URL ?? '').trim() || DEFAULT_SUREPASS_FACE_LIVENESS_URL;
    const providerName = (process.env.SUREPASS_PROVIDER ?? 'Surepass').trim();

    if (!token) {
      const msg =
        'Surepass face-liveness is not configured. Set SUREPASS_TOKEN (Bearer token) and optionally SUREPASS_FACE_LIVENESS_URL.';
      this.logger.warn(msg);
      return { configured: false, skipReason: msg, ok: false, httpStatus: null, vendorBody: null };
    }

    const form = new FormData();
    if (input.file) {
      form.set(
        'file',
        new Blob([new Uint8Array(input.file.buffer)], { type: input.file.mimetype || 'application/octet-stream' }),
        input.file.filename || 'file',
      );
    }
    if (input.link?.trim()) {
      form.set('link', input.link.trim());
    }
    if (input.usePdf) {
      form.set('use_pdf', 'true');
    }

    const requestedAt = new Date();
    let httpStatus: number | null = null;
    let vendorBody: unknown | null = null;
    let rawText = '';
    let error: Error | undefined;

    this.logger.log(
      `${providerName}/face-liveness request: POST ${url} file=${
        input.file ? `${input.file.filename} (${input.file.mimetype}, ${input.file.buffer.length} bytes)` : 'none'
      } link=${input.link?.trim() || 'none'} use_pdf=${Boolean(input.usePdf)}`,
    );

    try {
      const response = await fetch(url, {
        method: VENDOR_HTTP_METHOD.POST,
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      httpStatus = response.status;
      rawText = await response.text();
      try {
        vendorBody = rawText ? JSON.parse(rawText) : null;
      } catch {
        vendorBody = null;
      }
      this.logger.log(
        `${providerName}/face-liveness response: HTTP ${httpStatus} body=${rawText.slice(0, LOG_BODY_SNIPPET_CHARS) || '<empty>'}`,
      );
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      this.logger.warn(`${providerName}/face-liveness POST failed before response: ${error.message}`);
    }

    const ok = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;

    await this.vendorApi.auditOutboundCall({
      providerName,
      serviceName: 'face-liveness',
      requestMethod: VENDOR_HTTP_METHOD.POST,
      requestPath: url,
      leadId,
      requestHeaders: { Authorization: `Bearer ${token}`, 'content-type': 'multipart/form-data' },
      requestPayload: {
        file: input.file ? { filename: input.file.filename, mimetype: input.file.mimetype, size: input.file.buffer.length } : undefined,
        link: input.link?.trim() || undefined,
        use_pdf: input.usePdf ?? undefined,
      },
      responsePayload: vendorBody ?? (rawText ? { _unparsedBody: true, body: rawText } : error ? { error: error.message } : null),
      httpStatus,
      requestedAt,
      respondedAt: new Date(),
    });

    return { configured: true, ok, httpStatus, vendorBody, error };
  }
}
