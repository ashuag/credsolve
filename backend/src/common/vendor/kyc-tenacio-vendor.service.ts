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

/** Tenacio deepfake / synthetic media check on a single image URL. */
export type TenacioDeepfakeBody = {
  input: {
    consent: boolean;
    url: string;
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
 * Tenacio KYC add-ons: face match and deepfake detection.
 *
 * Face match env (either prefix works):
 * - `TENACIO_KYC_FACE_MATCH_*` or `TENACIO_FACE_MATCH_*`
 * - URL can be the full POST URL or the services base (`…/services`) plus `*_SERVICE=face-match`
 * Deepfake env: `TENACIO_DEEPFAKE_WORKFLOW_ID`, `TENACIO_DEEPFAKE_URL` or `TENACIO_DEEPFAKE_SERVICE`
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
      redactRequest: (b) => {
        const input = b?.input as Record<string, unknown> | undefined;
        return {
          ...b,
          input: {
            ...input,
            url1: typeof input?.url1 === 'string' ? `[REDACTED:${input.url1.length} chars]` : input?.url1,
            url2: typeof input?.url2 === 'string' ? `[REDACTED:${input.url2.length} chars]` : input?.url2,
          },
        };
      },
    });
  }

  isDeepfakeConfigured(): boolean {
    return Boolean(this.resolveAuth() && this.readEnv('TENACIO_DEEPFAKE_WORKFLOW_ID'));
  }

  async postDeepfakeCheck(body: TenacioDeepfakeBody, leadId: bigint | null): Promise<VendorCallResult> {
    return this.postService({
      workflowEnv: 'TENACIO_DEEPFAKE_WORKFLOW_ID',
      fullUrlEnv: 'TENACIO_DEEPFAKE_URL',
      serviceEnv: 'TENACIO_DEEPFAKE_SERVICE',
      auditEnv: 'TENACIO_DEEPFAKE_AUDIT_SERVICE',
      defaultAudit: 'deepfake-detection',
      missingWorkflowMsg: 'Set TENACIO_DEEPFAKE_WORKFLOW_ID for deepfake detection.',
      body,
      leadId,
      redactRequest: (b) => {
        const input = b?.input as Record<string, unknown> | undefined;
        return {
          ...b,
          input: {
            ...input,
            url: typeof input?.url === 'string' ? `[REDACTED:${input.url.length} chars]` : input?.url,
          },
        };
      },
    });
  }

  private async postService(params: {
    workflowEnv: string | string[];
    fullUrlEnv: string | string[];
    serviceEnv: string | string[];
    auditEnv: string | string[];
    defaultAudit: string;
    missingWorkflowMsg: string;
    body: TenacioFaceMatchBody | TenacioDeepfakeBody;
    leadId: bigint | null;
    redactRequest: (body: TenacioFaceMatchBody | TenacioDeepfakeBody | undefined) => unknown;
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

    this.logger.log(`Tenacio ${auditName} request: ${JSON.stringify(params.redactRequest(params.body))}`);

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
      redactRequest: params.redactRequest,
    });

    this.logger.log(
      `Tenacio ${auditName} response: HTTP ${result.httpStatus ?? 'n/a'} body=${JSON.stringify(result.body ?? result.rawText ?? null)}`,
    );

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
