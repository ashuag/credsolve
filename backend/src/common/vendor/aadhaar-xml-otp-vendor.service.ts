import { Injectable, Logger } from '@nestjs/common';
import { redactAadhaarXmlOtpRequest } from '../kyc/aadhaar-xml-otp.util';
import { VendorApiService } from './vendor-api.service';

export type AadhaarXmlGenerateOtpBody = {
  input: {
    aadhaarNumber: string;
    consent: boolean;
  };
};

export type AadhaarXmlDownloadBody = {
  input: {
    referenceId: string;
    otp: string;
  };
};

export type AadhaarXmlVendorCallResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
  error?: Error;
};

type UrlResolved = { absoluteUrl: string } | { baseUrl: string; path: string };

type PickUrlOutcome = AadhaarXmlVendorCallResult | { resolved: UrlResolved };

/**
 * Tenacio Aadhaar XML OTP generate + download. Uses {@link VendorApiService} → `vendor_api_log`.
 *
 * Env (auth): `TENACIO_CLIENT_ID`, `TENACIO_API_KEY`, `VENDOR_HOST`
 * Generate OTP: `TENACIO_AADHAAR_XML_OTP_SERVICE` / `_URL` / `_WORKFLOW_ID`
 * Download: `TENACIO_AADHAAR_XML_DOWNLOAD_SERVICE` / `_URL` / `_WORKFLOW_ID`
 */
@Injectable()
export class AadhaarXmlOtpVendorService {
  private readonly logger = new Logger(AadhaarXmlOtpVendorService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  async postGenerateOtp(
    body: AadhaarXmlGenerateOtpBody,
    leadId: bigint | null,
  ): Promise<AadhaarXmlVendorCallResult> {
    const auth = this.resolveAuth();
    if (!auth) {
      return this.authMissing();
    }
    const workflowId = (process.env.TENACIO_AADHAAR_XML_OTP_WORKFLOW_ID ?? '').trim();
    if (!workflowId) {
      return this.fail('Set TENACIO_AADHAAR_XML_OTP_WORKFLOW_ID (workflow-id header for xml-generate-otp).');
    }

    const fullUrl = (process.env.TENACIO_AADHAAR_XML_OTP_URL ?? '').trim();
    const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
    const serviceSlug = (process.env.TENACIO_AADHAAR_XML_OTP_SERVICE ?? '').trim();
    const picked = this.pickPostTarget(
      fullUrl,
      baseUrl,
      serviceSlug,
      'TENACIO_AADHAAR_XML_OTP_URL',
      'TENACIO_AADHAAR_XML_OTP_SERVICE',
    );
    if (!('resolved' in picked)) {
      return picked;
    }

    const auditName = (
      process.env.TENACIO_AADHAAR_XML_OTP_AUDIT_SERVICE ??
      (serviceSlug ? serviceSlug : 'xml-generate-otp')
    )
      .trim()
      .slice(0, 120);

    return this.postTenacio({
      auditName,
      target: picked.resolved,
      headers: this.headers(auth.clientId, auth.apiKey, workflowId),
      body,
      leadId,
      redactRequest: redactAadhaarXmlOtpRequest,
    });
  }

  async postXmlDownload(
    body: AadhaarXmlDownloadBody,
    leadId: bigint | null,
  ): Promise<AadhaarXmlVendorCallResult> {
    const auth = this.resolveAuth();
    if (!auth) {
      return this.authMissing();
    }
    const workflowId = (process.env.TENACIO_AADHAAR_XML_DOWNLOAD_WORKFLOW_ID ?? '').trim();
    if (!workflowId) {
      return this.fail('Set TENACIO_AADHAAR_XML_DOWNLOAD_WORKFLOW_ID (workflow-id header for xml-download).');
    }

    const fullUrl = (process.env.TENACIO_AADHAAR_XML_DOWNLOAD_URL ?? '').trim();
    const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
    const serviceSlug = (process.env.TENACIO_AADHAAR_XML_DOWNLOAD_SERVICE ?? '').trim();
    const picked = this.pickPostTarget(
      fullUrl,
      baseUrl,
      serviceSlug,
      'TENACIO_AADHAAR_XML_DOWNLOAD_URL',
      'TENACIO_AADHAAR_XML_DOWNLOAD_SERVICE',
    );
    if (!('resolved' in picked)) {
      return picked;
    }

    const auditName = (
      process.env.TENACIO_AADHAAR_XML_DOWNLOAD_AUDIT_SERVICE ??
      (serviceSlug ? serviceSlug : 'xml-download')
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

  private authMissing(): AadhaarXmlVendorCallResult {
    const msg = 'Aadhaar XML OTP is not configured. Set TENACIO_CLIENT_ID and TENACIO_API_KEY.';
    this.logger.warn(msg);
    return { configured: false, skipReason: msg, ok: false, httpStatus: null, vendorBody: null };
  }

  private fail(skipReason: string): AadhaarXmlVendorCallResult {
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
    target: UrlResolved;
    headers: Record<string, string>;
    body: AadhaarXmlGenerateOtpBody | AadhaarXmlDownloadBody;
    leadId: bigint | null;
    redactRequest?: (body: unknown) => unknown;
  }): Promise<AadhaarXmlVendorCallResult> {
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
      redactRequest: params.redactRequest,
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
