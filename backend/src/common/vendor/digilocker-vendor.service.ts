import { Injectable, Logger } from '@nestjs/common';
import { VendorApiService } from './vendor-api.service';

/** Minimal Tenacio-style body for DigiLocker session init (extend when vendor contract is known). */
export type DigilockerTenacioRequestBody = {
  input: Record<string, unknown>;
};

/**
 * Tenacio DigiLocker workflow init. Uses {@link VendorApiService} for audit (`vendor_api_log`).
 *
 * Env:
 * - `TENACIO_DIGILOCKER_URL` — optional full POST URL (recommended if path does not join cleanly).
 * - `TENACIO_DIGILOCKER_SERVICE` — path segment under `VENDOR_HOST` when URL is not set.
 * - `TENACIO_DIGILOCKER_WORKFLOW_ID` — sent as `workflow-id` header.
 * - `TENACIO_CLIENT_ID`, `TENACIO_API_KEY` — same as PAN/bureau.
 */
@Injectable()
export class DigilockerVendorService {
  private readonly logger = new Logger(DigilockerVendorService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  async postInit(
    body: DigilockerTenacioRequestBody,
    leadId: bigint | null,
  ): Promise<{
    configured: boolean;
    skipReason?: string;
    ok: boolean;
    httpStatus: number | null;
    vendorBody: unknown | null;
    error?: Error;
  }> {
    const fullUrl = (process.env.TENACIO_DIGILOCKER_URL ?? '').trim();
    const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
    const clientId = (process.env.TENACIO_CLIENT_ID ?? '').trim();
    const apiKey = (process.env.TENACIO_API_KEY ?? '').trim();
    const workflowId = (process.env.TENACIO_DIGILOCKER_WORKFLOW_ID ?? '').trim();
    const serviceSlug = (process.env.TENACIO_DIGILOCKER_SERVICE ?? '').trim();
    const providerName = (process.env.TENACIO_PROVIDER ?? 'Tenacio').trim();
    const auditName = (
      process.env.TENACIO_DIGILOCKER_AUDIT_SERVICE ??
      (serviceSlug ? serviceSlug : 'digilocker-init')
    )
      .trim()
      .slice(0, 120);

    if (!clientId || !apiKey || !workflowId) {
      const msg =
        'DigiLocker is not configured. Set TENACIO_CLIENT_ID, TENACIO_API_KEY, and TENACIO_DIGILOCKER_WORKFLOW_ID. When not using TENACIO_DIGILOCKER_URL, also set VENDOR_HOST and TENACIO_DIGILOCKER_SERVICE.';
      this.logger.warn(msg);
      return {
        configured: false,
        skipReason: msg,
        ok: false,
        httpStatus: null,
        vendorBody: null,
      };
    }

    if (!fullUrl && (!baseUrl || !serviceSlug)) {
      const msg =
        'DigiLocker is not configured. Set TENACIO_DIGILOCKER_URL to the full POST URL, or set VENDOR_HOST and TENACIO_DIGILOCKER_SERVICE.';
      this.logger.warn(msg);
      return {
        configured: false,
        skipReason: msg,
        ok: false,
        httpStatus: null,
        vendorBody: null,
      };
    }

    const result = await this.vendorApi.request<unknown, DigilockerTenacioRequestBody>({
      providerName,
      serviceName: auditName,
      method: 'POST',
      ...(fullUrl ? { absoluteUrl: fullUrl } : { baseUrl, path: serviceSlug! }),
      headers: {
        'client-id': clientId,
        'x-api-key': apiKey,
        'workflow-id': workflowId,
      },
      body,
      leadId,
    });

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody: result.body,
      error: result.error,
    };
  }
}
