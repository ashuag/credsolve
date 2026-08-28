import { Injectable, Logger } from '@nestjs/common';
import { VendorApiService } from './vendor-api.service';

/** Tenacio POST body for `digilocker-generate-url` (redirect after DigiLocker login). */
export type DigilockerGenerateUrlBody = {
  input: {
    redirectUrl: string;
    consent: boolean;
  };
};

/** Tenacio POST body for Aadhaar download after DigiLocker session. */
export type DigilockerAadhaarDownloadBody = {
  input: {
    sessionToken: string;
    consent: boolean;
  };
};

type VendorCallResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
  error?: Error;
};

type UrlResolved = { absoluteUrl: string } | { baseUrl: string; path: string };

type PickUrlOutcome = VendorCallResult | { resolved: UrlResolved };

/**
 * Tenacio DigiLocker + Aadhaar download. Uses {@link VendorApiService} → `vendor_api_log`.
 *
 * Env (auth, all calls):
 * - `TENACIO_CLIENT_ID`, `TENACIO_API_KEY`, `VENDOR_HOST`
 *
 * Generate URL:
 * - `TENACIO_DIGILOCKER_WORKFLOW_ID` — `workflow-id` header
 * - `TENACIO_DIGILOCKER_URL` or `TENACIO_DIGILOCKER_SERVICE` (path under `VENDOR_HOST`), e.g. `digilocker-generate-url`
 *
 * Aadhaar download:
 * - `TENACIO_AADHAAR_DOWNLOAD_SERVICE` — path under `VENDOR_HOST` when URL not set
 * - `TENACIO_AADHAAR_DOWNLOAD_URL` — optional full POST URL
 * - `TENACIO_AADHAAR_DOWNLOAD_WORKFLOW_ID` — optional; falls back to `TENACIO_DIGILOCKER_WORKFLOW_ID`
 */
@Injectable()
export class DigilockerVendorService {
  private readonly logger = new Logger(DigilockerVendorService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  async postGenerateUrl(
    body: DigilockerGenerateUrlBody,
    leadId: bigint | null,
  ): Promise<VendorCallResult> {
    const auth = this.resolveAuth();
    if (!auth) {
      return this.authMissing();
    }
    const workflowId = (process.env.TENACIO_DIGILOCKER_WORKFLOW_ID ?? '').trim();
    if (!workflowId) {
      return this.fail('Set TENACIO_DIGILOCKER_WORKFLOW_ID (workflow-id header for generate URL).');
    }

    const fullUrl = (process.env.TENACIO_DIGILOCKER_URL ?? '').trim();
    const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
    const serviceSlug = (process.env.TENACIO_DIGILOCKER_SERVICE ?? '').trim();
    const picked = this.pickPostTarget(
      fullUrl,
      baseUrl,
      serviceSlug,
      'TENACIO_DIGILOCKER_URL',
      'TENACIO_DIGILOCKER_SERVICE',
    );
    if (!('resolved' in picked)) {
      return picked;
    }

    const auditName = (
      process.env.TENACIO_DIGILOCKER_AUDIT_SERVICE ??
      (serviceSlug ? serviceSlug : 'digilocker-generate-url')
    )
      .trim()
      .slice(0, 120);

    return this.postTenacio({
      auditName,
      target: picked.resolved,
      headers: this.headers(auth.clientId, auth.apiKey, workflowId),
      body,
      leadId,
    });
  }

  async postAadhaarDownload(
    body: DigilockerAadhaarDownloadBody,
    leadId: bigint | null,
  ): Promise<VendorCallResult> {
    const auth = this.resolveAuth();
    if (!auth) {
      return this.authMissing();
    }
    const workflowId = (
      process.env.TENACIO_AADHAAR_DOWNLOAD_WORKFLOW_ID ??
      process.env.TENACIO_DIGILOCKER_WORKFLOW_ID ??
      ''
    ).trim();
    if (!workflowId) {
      return this.fail(
        'Set TENACIO_DIGILOCKER_WORKFLOW_ID or TENACIO_AADHAAR_DOWNLOAD_WORKFLOW_ID for Aadhaar download.',
      );
    }

    const fullUrl = (process.env.TENACIO_AADHAAR_DOWNLOAD_URL ?? '').trim();
    const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
    const serviceSlug = (process.env.TENACIO_AADHAAR_DOWNLOAD_SERVICE ?? '').trim();
    const picked = this.pickPostTarget(
      fullUrl,
      baseUrl,
      serviceSlug,
      'TENACIO_AADHAAR_DOWNLOAD_URL',
      'TENACIO_AADHAAR_DOWNLOAD_SERVICE',
    );
    if (!('resolved' in picked)) {
      return picked;
    }

    const auditName = (
      process.env.TENACIO_AADHAAR_DOWNLOAD_AUDIT_SERVICE ??
      (serviceSlug ? serviceSlug : 'aadhaar-download')
    )
      .trim()
      .slice(0, 120);

    return this.postTenacio({
      auditName,
      target: picked.resolved,
      headers: this.headers(auth.clientId, auth.apiKey, workflowId),
      body,
      leadId,
    });
  }

  private resolveAuth(): { clientId: string; apiKey: string } | null {
    const clientId = (process.env.TENACIO_CLIENT_ID ?? '').trim();
    const apiKey = (process.env.TENACIO_API_KEY ?? '').trim();
    if (!clientId || !apiKey) {
      return null;
    }
    return { clientId, apiKey };
  }

  private authMissing(): VendorCallResult {
    const msg = 'DigiLocker is not configured. Set TENACIO_CLIENT_ID and TENACIO_API_KEY.';
    this.logger.warn(msg);
    return { configured: false, skipReason: msg, ok: false, httpStatus: null, vendorBody: null };
  }

  private fail(skipReason: string): VendorCallResult {
    this.logger.warn(skipReason);
    return { configured: false, skipReason, ok: false, httpStatus: null, vendorBody: null };
  }

  private pickPostTarget(
    fullUrl: string,
    baseUrl: string,
    serviceSlug: string,
    fullEnvName: string,
    slugEnvName: string,
  ): PickUrlOutcome {
    if (fullUrl) {
      return { resolved: { absoluteUrl: fullUrl } };
    }
    if (baseUrl && serviceSlug) {
      return { resolved: { baseUrl, path: serviceSlug } };
    }
    const msg = `Set ${fullEnvName} to the full POST URL, or set VENDOR_HOST and ${slugEnvName}.`;
    return this.fail(msg);
  }

  private headers(clientId: string, apiKey: string, workflowId: string): Record<string, string> {
    return {
      'client-id': clientId,
      'x-api-key': apiKey,
      'workflow-id': workflowId,
    };
  }

  private async postTenacio(params: {
    auditName: string;
    target: { absoluteUrl: string } | { baseUrl: string; path: string };
    headers: Record<string, string>;
    body: DigilockerGenerateUrlBody | DigilockerAadhaarDownloadBody;
    leadId: bigint | null;
  }): Promise<VendorCallResult> {
    const providerName = (process.env.TENACIO_PROVIDER ?? 'Tenacio').trim();
    const result = await this.vendorApi.request<unknown, typeof params.body>({
      providerName,
      serviceName: params.auditName,
      method: 'POST',
      ...('absoluteUrl' in params.target
        ? { absoluteUrl: params.target.absoluteUrl }
        : { baseUrl: params.target.baseUrl, path: params.target.path }),
      headers: params.headers,
      body: params.body,
      leadId: params.leadId,
    });

    const vendorBody =
      result.body ??
      (result.rawText
        ? {
            _unparsedResponse: true,
            httpStatus: result.httpStatus,
            body: result.rawText.slice(0, 32_000),
          }
        : null);

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody,
      error: result.error,
    };
  }
}
