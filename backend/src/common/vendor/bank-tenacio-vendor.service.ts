import { Injectable, Logger } from '@nestjs/common';
import { VendorApiService } from './vendor-api.service';

export type TenacioPennyDropBody = {
  input: {
    mobileNumber: string;
    bankAccountNumber: string;
    ifscNumber: string;
    name: string;
    consent: boolean;
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

/** Penny-drop can sit behind the bank IMPS/name-enquiry hop; 30s is too tight. */
const PENNY_DROP_TIMEOUT_MS = 60_000;

/**
 * Tenacio penny-drop style bank verification.
 *
 * (IFSC lookup has moved to Credostack — see `CredostackIfscService`.)
 *
 * Penny drop env: `TENACIO_PENNY_DROP_WORKFLOW_ID`, and either `TENACIO_PENNY_DROP_URL` or
 * `VENDOR_HOST` + `TENACIO_PENNY_DROP_SERVICE`.
 */
@Injectable()
export class BankTenacioVendorService {
  private readonly logger = new Logger(BankTenacioVendorService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  async postPennyDrop(body: TenacioPennyDropBody, leadId: bigint | null): Promise<VendorCallResult> {
    const auth = this.resolveAuth();
    if (!auth) {
      return this.authMissing();
    }
    const workflowId = (process.env.TENACIO_PENNY_DROP_WORKFLOW_ID ?? '').trim();
    if (!workflowId) {
      return this.fail('Set TENACIO_PENNY_DROP_WORKFLOW_ID for bank verification.');
    }

    const fullUrl = (process.env.TENACIO_PENNY_DROP_URL ?? '').trim();
    const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
    const serviceSlug = (process.env.TENACIO_PENNY_DROP_SERVICE ?? '').trim();
    const picked = this.pickPostTarget(
      fullUrl,
      baseUrl,
      serviceSlug,
      'TENACIO_PENNY_DROP_URL',
      'TENACIO_PENNY_DROP_SERVICE',
    );
    if (!('resolved' in picked)) {
      return picked;
    }

    const auditName = (process.env.TENACIO_PENNY_DROP_AUDIT_SERVICE ?? 'penny-drop').trim().slice(0, 120);
    return this.postTenacio({
      auditName,
      picked: picked.resolved,
      workflowId,
      body,
      leadId,
      timeoutMs: PENNY_DROP_TIMEOUT_MS,
      redactRequest: (b) => {
        const input = b?.input as Record<string, unknown> | undefined;
        const acct = input?.bankAccountNumber;
        if (typeof acct !== 'string') return b;
        return {
          ...b,
          input: {
            ...input,
            bankAccountNumber: `[REDACTED:${acct.length} digits]`,
          },
        };
      },
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
    const msg = 'Bank verification is not configured. Set TENACIO_CLIENT_ID and TENACIO_API_KEY.';
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
    const full = fullUrl.trim();
    if (full) {
      // Only treat as absolute outbound URL when a scheme is present; otherwise
      // `fetch("ifsc-details")` throws "Failed to parse URL". Join under VENDOR_HOST instead.
      if (/^https?:\/\//i.test(full)) {
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
    if (baseUrl.trim() && serviceSlug.trim()) {
      return { resolved: { baseUrl: baseUrl.trim(), path: serviceSlug.trim() } };
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

  private async postTenacio(params: {
    auditName: string;
    picked: UrlResolved;
    workflowId: string;
    body: TenacioPennyDropBody;
    leadId: bigint | null;
    timeoutMs?: number;
    redactRequest: (body: TenacioPennyDropBody | undefined) => unknown;
  }): Promise<VendorCallResult> {
    const auth = this.resolveAuth();
    if (!auth) {
      return this.authMissing();
    }

    const providerName = (process.env.TENACIO_PROVIDER ?? 'Tenacio').trim();
    const result = await this.vendorApi.request<unknown, typeof params.body>({
      providerName,
      serviceName: params.auditName,
      method: 'POST',
      ...('absoluteUrl' in params.picked
        ? { absoluteUrl: params.picked.absoluteUrl }
        : { baseUrl: params.picked.baseUrl, path: params.picked.path }),
      headers: this.headers(auth.clientId, auth.apiKey, params.workflowId),
      body: params.body,
      leadId: params.leadId,
      timeoutMs: params.timeoutMs,
      redactRequest: params.redactRequest,
    });

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody: result.body,
    };
  }
}
