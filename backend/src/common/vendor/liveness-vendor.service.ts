import { Injectable, Logger } from '@nestjs/common';
import { VendorApiService } from './vendor-api.service';

/** Tenacio POST body for `/services/liveness` — selfie fetched from `input.url`. */
export type TenacioLivenessBody = {
  input: {
    consent: boolean;
    /** Public HTTPS URL where the stored selfie JPEG/PNG can be downloaded. */
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
 * Face liveness via Tenacio.
 *
 * - `TENACIO_LIVENESS_SERVICE` — path under `VENDOR_HOST` (e.g. `liveness`)
 * - `TENACIO_LIVENESS_URL` — optional full POST URL
 * - `TENACIO_LIVENESS_WORKFLOW_ID` — `workflow-id` header
 */
@Injectable()
export class LivenessVendorService {
  private readonly logger = new Logger(LivenessVendorService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  async postLivenessCheck(
    body: TenacioLivenessBody,
    leadId: bigint | null,
    selfieStoragePath?: string | null,
  ): Promise<VendorCallResult> {
    const auth = this.resolveAuth();
    if (!auth) {
      return this.authMissing();
    }
    const workflowId = (process.env.TENACIO_LIVENESS_WORKFLOW_ID ?? '').trim();
    if (!workflowId) {
      return this.fail('Set TENACIO_LIVENESS_WORKFLOW_ID for liveness checks.');
    }

    const selfieUrl = body.input.url.trim();
    if (!/^https?:\/\//i.test(selfieUrl)) {
      return this.fail('Liveness selfie URL must be an absolute http(s) URL.');
    }

    const fullUrl = (process.env.TENACIO_LIVENESS_URL ?? '').trim();
    const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
    const serviceSlug = (process.env.TENACIO_LIVENESS_SERVICE ?? '').trim();
    const picked = this.pickPostTarget(
      fullUrl,
      baseUrl,
      serviceSlug,
      'TENACIO_LIVENESS_URL',
      'TENACIO_LIVENESS_SERVICE',
    );
    if (!('resolved' in picked)) {
      return picked;
    }

    const auditName = (process.env.TENACIO_LIVENESS_AUDIT_SERVICE ?? 'liveness').trim().slice(0, 120);

    const livenessInput = {
      input: {
        consent: body.input.consent,
        url: selfieUrl,
      },
    };
    const storagePath = selfieStoragePath?.trim();
    this.logger.log(
      storagePath
        ? `Tenacio liveness POST input (selfiePath=${storagePath}): ${JSON.stringify(livenessInput)}`
        : `Tenacio liveness POST input: ${JSON.stringify(livenessInput)}`,
    );

    const providerName = (process.env.TENACIO_PROVIDER ?? 'Tenacio').trim();
    const result = await this.vendorApi.request<unknown, TenacioLivenessBody>({
      providerName,
      serviceName: auditName,
      method: 'POST',
      ...('absoluteUrl' in picked.resolved
        ? { absoluteUrl: picked.resolved.absoluteUrl }
        : { baseUrl: picked.resolved.baseUrl, path: picked.resolved.path }),
      headers: this.headers(auth.clientId, auth.apiKey, workflowId),
      body: livenessInput,
      leadId,
      redactRequest: (b) => {
        const input = b?.input as Record<string, unknown> | undefined;
        const url = input?.url;
        if (typeof url !== 'string') return b;
        return {
          ...b,
          input: {
            ...input,
            url: `[REDACTED:${url.length} chars]`,
          },
        };
      },
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
    const msg = 'Liveness is not configured. Set TENACIO_CLIENT_ID and TENACIO_API_KEY.';
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
}
