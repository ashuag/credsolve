import { Injectable, Logger } from '@nestjs/common';
import { VendorApiService } from './vendor-api.service';

/** Tenacio face match — compare reference (e.g. Aadhaar) vs probe (selfie). */
export type TenacioFaceMatchBody = {
  input: {
    consent: boolean;
    /** Document / reference photo URL */
    url1: string;
    /** Live selfie URL */
    url2: string;
  };
};

type VendorCallResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
};

type UrlResolved = { absoluteUrl: string } | { baseUrl: string; path: string };

type PickUrlOutcome = VendorCallResult | { resolved: UrlResolved };

/**
 * Tenacio KYC face match.
 *
 * Face match env (either prefix works):
 * - `TENACIO_KYC_FACE_MATCH_*` or `TENACIO_FACE_MATCH_*`
 * - URL can be the full POST URL or the services base (`…/services`) plus `*_SERVICE=face-match`
 */
@Injectable()
export class KycTenacioVendorService {
  private readonly logger = new Logger(KycTenacioVendorService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  async postFaceMatch(body: TenacioFaceMatchBody, leadId: bigint | null): Promise<VendorCallResult> {
    return this.postService({
      workflowEnv: ['TENACIO_KYC_FACE_MATCH_WORKFLOW_ID', 'TENACIO_FACE_MATCH_WORKFLOW_ID'],
      fullUrlEnv: ['TENACIO_KYC_FACE_MATCH_URL', 'TENACIO_FACE_MATCH_URL'],
      serviceEnv: ['TENACIO_KYC_FACE_MATCH_SERVICE', 'TENACIO_FACE_MATCH_SERVICE'],
      auditEnv: ['TENACIO_KYC_FACE_MATCH_AUDIT_SERVICE', 'TENACIO_FACE_MATCH_AUDIT_SERVICE'],
      defaultAudit: 'face-match',
      missingWorkflowMsg:
        'Set TENACIO_KYC_FACE_MATCH_WORKFLOW_ID (or TENACIO_FACE_MATCH_WORKFLOW_ID) for face match checks.',
      body,
      leadId,
    });
  }

  isFaceMatchConfigured(): boolean {
    return Boolean(
      this.resolveAuth() &&
        this.readEnv(['TENACIO_KYC_FACE_MATCH_WORKFLOW_ID', 'TENACIO_FACE_MATCH_WORKFLOW_ID']),
    );
  }

  private async postService(params: {
    workflowEnv: string | string[];
    fullUrlEnv: string | string[];
    serviceEnv: string | string[];
    auditEnv: string | string[];
    defaultAudit: string;
    missingWorkflowMsg: string;
    body: TenacioFaceMatchBody;
    leadId: bigint | null;
    redactRequest?: (body: TenacioFaceMatchBody | undefined) => unknown;
  }): Promise<VendorCallResult> {
    const auth = this.resolveAuth();
    if (!auth) {
      return this.authMissing();
    }

    const workflowId = this.readEnv(params.workflowEnv);
    if (!workflowId) {
      return this.fail(params.missingWorkflowMsg);
    }

    const fullUrl = this.readEnv(params.fullUrlEnv);
    const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
    const serviceSlug = this.readEnv(params.serviceEnv);
    const fullUrlEnvLabel = envLabel(params.fullUrlEnv);
    const serviceEnvLabel = envLabel(params.serviceEnv);
    const picked = this.pickPostTarget(
      fullUrl,
      baseUrl,
      serviceSlug,
      fullUrlEnvLabel,
      serviceEnvLabel,
    );
    if (!('resolved' in picked)) {
      return picked;
    }

    const auditName = (this.readEnv(params.auditEnv) || params.defaultAudit).trim().slice(0, 120);
    const providerName = (process.env.TENACIO_PROVIDER ?? 'Tenacio').trim();

    this.logger.log(`${auditName} POST input: ${JSON.stringify(params.body)}`);

    const result = await this.vendorApi.request<unknown, typeof params.body>({
      providerName,
      serviceName: auditName,
      method: 'POST',
      ...('absoluteUrl' in picked.resolved
        ? { absoluteUrl: picked.resolved.absoluteUrl }
        : { baseUrl: picked.resolved.baseUrl, path: picked.resolved.path }),
      headers: this.headers(auth.clientId, auth.apiKey, workflowId),
      body: params.body,
      leadId: params.leadId,
      ...(params.redactRequest ? { redactRequest: params.redactRequest } : {}),
    });

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody: result.body,
    };
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
    const msg = 'Tenacio is not configured. Set TENACIO_CLIENT_ID and TENACIO_API_KEY.';
    this.logger.warn(msg);
    return { configured: false, skipReason: msg, ok: false, httpStatus: null, vendorBody: null };
  }

  private fail(skipReason: string): VendorCallResult {
    this.logger.warn(skipReason);
    return { configured: false, skipReason, ok: false, httpStatus: null, vendorBody: null };
  }

  private readEnv(names: string | string[]): string {
    for (const name of Array.isArray(names) ? names : [names]) {
      const value = (process.env[name] ?? '').trim();
      if (value) return value;
    }
    return '';
  }

  private pickPostTarget(
    fullUrl: string,
    baseUrl: string,
    serviceSlug: string,
    fullEnvName: string,
    slugEnvName: string,
  ): PickUrlOutcome {
    const full = fullUrl.trim();
    const slug = serviceSlug.trim();
    if (full) {
      if (/^https?:\/\//i.test(full)) {
        if (slug && isTenacioServicesBaseUrl(full) && !urlEndsWithServiceSlug(full, slug)) {
          return { resolved: { baseUrl: full.replace(/\/+$/, ''), path: slug } };
        }
        return { resolved: { absoluteUrl: full } };
      }
      const b = baseUrl.trim();
      if (b) {
        return { resolved: { baseUrl: b, path: full.replace(/^\/+/, '') } };
      }
      return this.fail(
        `${fullEnvName} is "${full}" (relative path) but VENDOR_HOST is empty. ` +
          `Set a full https://… URL in ${fullEnvName}, or set VENDOR_HOST and put the path in ${slugEnvName} only.`,
      );
    }
    if (baseUrl.trim() && slug) {
      return { resolved: { baseUrl: baseUrl.trim(), path: slug } };
    }
    const msg = `Set ${fullEnvName} to the full POST URL (https://…), or set VENDOR_HOST and ${slugEnvName}.`;
    return this.fail(msg);
  }

  private headers(clientId: string, apiKey: string, workflowId: string): Record<string, string> {
    return {
      'client-id': clientId,
      'x-api-key': apiKey,
      'workflow-id': workflowId,
    };
  }
}

function envLabel(names: string | string[]): string {
  const list = Array.isArray(names) ? names : [names];
  return list.join(' or ');
}

function isTenacioServicesBaseUrl(url: string): boolean {
  return /\/services\/?$/i.test(url.replace(/\/+$/, ''));
}

function urlEndsWithServiceSlug(url: string, slug: string): boolean {
  const normalized = url.replace(/\/+$/, '');
  const cleanSlug = slug.replace(/^\/+|\/+$/g, '');
  return normalized.endsWith(`/${cleanSlug}`);
}
