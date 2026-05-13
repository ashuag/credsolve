import { Injectable, Logger } from '@nestjs/common';
import { VendorApiService } from './vendor-api.service';

/**
 * Tenacio bureau slug: with `VENDOR_HOST` ending in `…/api/v1/services`, outbound
 * URL is `…/api/v1/services/cibil-soft-pull` (i.e. `/services/cibil-soft-pull`
 * under the `v1` API root).
 */
export const TENACIO_CIBIL_SOFT_PULL_SERVICE = 'cibil-soft-pull';

export type CibilTenacioInput = {
  mobileNumber: string;
  name: string;
  panNumber: string;
  consent: boolean;
};

export type CibilTenacioRequestBody = {
  input: CibilTenacioInput;
};

function maskPan(pan: string | undefined): string {
  if (!pan || pan.length < 4) return '*****';
  return `******${pan.slice(-4)}`;
}

function maskMobile(mobile: string | undefined): string {
  if (!mobile || mobile.length < 4) return '****';
  return `******${mobile.slice(-4)}`;
}

/**
 * Tenacio CIBIL (or bureau) pull using the same base URL, client-id, and
 * x-api-key as PAN NSDL. Path and workflow-id are configured separately
 * (`TENACIO_CIBIL_*`). Every call is audited via {@link VendorApiService} →
 * `vendor_api_log`.
 */
@Injectable()
export class CibilFetchService {
  private readonly logger = new Logger(CibilFetchService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  /**
   * POST to `${VENDOR_HOST}/${slug}` (default slug {@link TENACIO_CIBIL_SOFT_PULL_SERVICE}) with the given JSON body.
   * Returns the vendor HTTP outcome and parsed JSON when available.
   */
  async fetchFromTenacio(
    body: CibilTenacioRequestBody,
    leadId: bigint | null,
  ): Promise<{
    configured: boolean;
    skipReason?: string;
    ok: boolean;
    httpStatus: number | null;
    vendorBody: unknown | null;
    error?: Error;
  }> {
    const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
    const clientId = (process.env.TENACIO_CLIENT_ID ?? '').trim();
    const apiKey = (process.env.TENACIO_API_KEY ?? '').trim();
    const workflowId = (
      process.env.TENACIO_CIBIL_WORKFLOW_ID ??
      process.env.TENACIO_PAN_NSDL_WORKFLOW_ID ??
      ''
    ).trim();
    const serviceSlug =
      (process.env.TENACIO_CIBIL_SERVICE ?? '').trim() || TENACIO_CIBIL_SOFT_PULL_SERVICE;
    const providerName = (process.env.TENACIO_PROVIDER ?? 'Tenacio').trim();

    if (!baseUrl || !clientId || !apiKey || !workflowId) {
      const msg =
        'Tenacio CIBIL is not configured. Set VENDOR_HOST, TENACIO_CLIENT_ID, TENACIO_API_KEY, and TENACIO_CIBIL_WORKFLOW_ID (or reuse TENACIO_PAN_NSDL_WORKFLOW_ID). Optional: TENACIO_CIBIL_SERVICE overrides the default `cibil-soft-pull` slug.';
      this.logger.warn(msg);
      return {
        configured: false,
        skipReason: msg,
        ok: false,
        httpStatus: null,
        vendorBody: null,
      };
    }

    const normalizedBody: CibilTenacioRequestBody = {
      input: {
        ...body.input,
        panNumber: body.input.panNumber.trim().toUpperCase(),
        mobileNumber: body.input.mobileNumber.trim(),
        name: body.input.name.trim(),
        consent: body.input.consent,
      },
    };

    const result = await this.vendorApi.request<unknown, CibilTenacioRequestBody>({
      providerName,
      serviceName: serviceSlug,
      method: 'POST',
      baseUrl,
      path: serviceSlug,
      headers: {
        'client-id': clientId,
        'x-api-key': apiKey,
        'workflow-id': workflowId,
      },
      body: normalizedBody,
      leadId,
      redactRequest: (b) => ({
        ...b,
        input: {
          ...b?.input,
          panNumber: maskPan(b?.input?.panNumber),
          mobileNumber: maskMobile(b?.input?.mobileNumber),
        },
      }),
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
