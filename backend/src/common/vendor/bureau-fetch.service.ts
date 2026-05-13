import { Injectable, Logger } from '@nestjs/common';
import { readBureauFetchMode } from '../constants/bureau-fetch-settings.util';
import { PrismaService } from '../../prisma/prisma.service';
import { TENACIO_BUREAU_MOCK_VENDOR_BODY } from './tenacio-bureau-mock.fixture';
import { VendorApiService } from './vendor-api.service';

/**
 * Default relative path when `VENDOR_HOST` is `…/api/v1/services` and
 * `TENACIO_CIBIL_URL` is not set (path appended to `VENDOR_HOST`).
 * Prefer `TENACIO_CIBIL_URL` with the full HTTPS URL if joining is error-prone.
 */
export const TENACIO_BUREAU_SOFT_PULL_SERVICE = 'experian-soft-pull/services/experian-soft-pull';

export type BureauTenacioInput = {
  mobileNumber: string;
  name: string;
  panNumber: string;
  consent: boolean;
};

export type BureauTenacioRequestBody = {
  input: BureauTenacioInput;
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
 * Tenacio bureau pull (Experian/CIBIL workflow) using the same base URL, client-id, and
 * x-api-key as PAN NSDL. Path and `workflow-id` use `TENACIO_CIBIL_*` env vars (Tenacio naming).
 * Every live call is audited via {@link VendorApiService} → `vendor_api_log`.
 */
@Injectable()
export class BureauFetchService {
  private readonly logger = new Logger(BureauFetchService.name);

  constructor(
    private readonly vendorApi: VendorApiService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST to Tenacio bureau: uses `TENACIO_CIBIL_URL` when set (full URL),
   * otherwise `${VENDOR_HOST}/${path}` with path from `TENACIO_CIBIL_SERVICE` or
   * {@link TENACIO_BUREAU_SOFT_PULL_SERVICE}.
   */
  async fetchBureauFromTenacio(
    body: BureauTenacioRequestBody,
    leadId: bigint | null,
  ): Promise<{
    configured: boolean;
    skipReason?: string;
    ok: boolean;
    httpStatus: number | null;
    vendorBody: unknown | null;
    error?: Error;
    /** True when `BUREAU_FETCH_ENABLED=2` (mock fixture); persist on `bureau_report.dummy_fetched`. */
    dummyPayload: boolean;
  }> {
    const bureauMode = await readBureauFetchMode(this.prisma.client);
    if (bureauMode === 2) {
      this.logger.debug(
        `Tenacio bureau skipped (mock): BUREAU_FETCH_ENABLED=2 leadId=${leadId?.toString() ?? 'n/a'}`,
      );
      return {
        configured: true,
        ok: true,
        httpStatus: 200,
        vendorBody: structuredClone(TENACIO_BUREAU_MOCK_VENDOR_BODY),
        dummyPayload: true,
      };
    }

    const fullBureauUrl = (process.env.TENACIO_CIBIL_URL ?? '').trim();
    const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
    const clientId = (process.env.TENACIO_CLIENT_ID ?? '').trim();
    const apiKey = (process.env.TENACIO_API_KEY ?? '').trim();
    const workflowId = (process.env.TENACIO_CIBIL_WORKFLOW_ID ?? '').trim();
    const serviceSlug =
      (process.env.TENACIO_CIBIL_SERVICE ?? '').trim() || TENACIO_BUREAU_SOFT_PULL_SERVICE;
    const auditServiceName = (
      process.env.TENACIO_CIBIL_AUDIT_SERVICE ??
      (fullBureauUrl ? 'experian-soft-pull' : serviceSlug)
    ).trim();
    const providerName = (process.env.TENACIO_PROVIDER ?? 'Tenacio').trim();

    if (!clientId || !apiKey || !workflowId) {
      const msg =
        'Tenacio bureau is not configured. Set TENACIO_CLIENT_ID, TENACIO_API_KEY, TENACIO_CIBIL_WORKFLOW_ID (bureau `workflow-id` header), and TENACIO_CIBIL_URL (recommended) or VENDOR_HOST.';
      this.logger.warn(msg);
      return {
        configured: false,
        skipReason: msg,
        ok: false,
        httpStatus: null,
        vendorBody: null,
        dummyPayload: false,
      };
    }

    if (!fullBureauUrl && !baseUrl) {
      const msg =
        'Tenacio bureau is not configured. Set TENACIO_CIBIL_URL to the full bureau POST URL, or set VENDOR_HOST and optional TENACIO_CIBIL_SERVICE.';
      this.logger.warn(msg);
      return {
        configured: false,
        skipReason: msg,
        ok: false,
        httpStatus: null,
        vendorBody: null,
        dummyPayload: false,
      };
    }

    const normalizedBody: BureauTenacioRequestBody = {
      input: {
        ...body.input,
        panNumber: body.input.panNumber.trim().toUpperCase(),
        mobileNumber: body.input.mobileNumber.trim(),
        name: body.input.name.trim(),
        consent: body.input.consent,
      },
    };

    const result = await this.vendorApi.request<unknown, BureauTenacioRequestBody>({
      providerName,
      serviceName: auditServiceName.slice(0, 120),
      method: 'POST',
      ...(fullBureauUrl
        ? { absoluteUrl: fullBureauUrl }
        : { baseUrl, path: serviceSlug }),
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
      dummyPayload: false,
    };
  }
}
