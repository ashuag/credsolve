import { Injectable, Logger } from '@nestjs/common';
import { VENDOR_API_NAME } from '../constants/vendor-api-config.constants';
import {
  extractDigilockerLoginUrl,
  extractDigilockerSessionToken,
} from './digilocker-response.util';
import { DigilockerVendorService } from './digilocker-vendor.service';
import { SurepassDigilockerService } from './surepass/surepass-digilocker.service';
import type { DigilockerPanCertificateFields } from './surepass/surepass-digilocker.mapper';
import { VendorApiConfigService } from './vendor-api-config.service';

export type DigilockerVendorKind = 'surepass' | 'tenacio';

export type DigilockerFetchResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
  error?: Error;
  /** Active DigiLocker vendor that handled this call. */
  vendorKind: DigilockerVendorKind | null;
  /** Session token for download (Tenacio sessionToken or Surepass client_id). */
  sessionToken?: string | null;
  digilockerLoginUrl?: string | null;
};

export type DigilockerPanFetchResult = DigilockerFetchResult & {
  downloadUrl?: string | null;
  panFields?: DigilockerPanCertificateFields | null;
};

/**
 * DigiLocker vendor router. ACTIVE `kyc_digilocker` vendors from
 * `vendor_api_config` are tried in priority order; a non-200 response
 * (or misconfiguration) moves to the next vendor.
 *
 * Download stays pinned to the vendor that issued the session token —
 * Surepass `client_id` and Tenacio `sessionToken` are not interchangeable.
 */
@Injectable()
export class DigilockerFetchService {
  private readonly logger = new Logger(DigilockerFetchService.name);

  constructor(
    private readonly vendorApiConfig: VendorApiConfigService,
    private readonly surepassDigilocker: SurepassDigilockerService,
    private readonly tenacioDigilocker: DigilockerVendorService,
  ) {}

  /**
   * ACTIVE DigiLocker vendors ordered by priority (primary first).
   * Defaults to Surepass → Tenacio when no config rows exist.
   */
  async resolveVendorChain(): Promise<DigilockerVendorKind[]> {
    const rows = await this.vendorApiConfig.listActiveByApiName(VENDOR_API_NAME.KYC_DIGILOCKER);
    if (rows.length === 0) {
      this.logger.debug(
        `No ACTIVE vendor_api_config for api_name=${VENDOR_API_NAME.KYC_DIGILOCKER}; defaulting to Surepass → Tenacio.`,
      );
      return ['surepass', 'tenacio'];
    }
    const chain: DigilockerVendorKind[] = [];
    for (const row of rows) {
      const kind: DigilockerVendorKind =
        row.vendorName.trim().toLowerCase() === 'surepass' ? 'surepass' : 'tenacio';
      if (!chain.includes(kind)) chain.push(kind);
    }
    return chain;
  }

  /** @deprecated Prefer {@link resolveVendorChain}; kept for callers that want primary only. */
  async resolvePrimaryVendor(): Promise<DigilockerVendorKind> {
    const chain = await this.resolveVendorChain();
    return chain[0] ?? 'tenacio';
  }

  /**
   * Initialize DigiLocker login URL. Tries ACTIVE vendors by priority until
   * one returns HTTP 200 with a usable session token + login URL.
   */
  async initialize(
    redirectUrl: string,
    leadId: bigint | null,
    preferredVendor?: DigilockerVendorKind | null,
  ): Promise<DigilockerFetchResult> {
    const chain = preferredVendor
      ? [preferredVendor]
      : await this.resolveVendorChain();

    if (chain.length === 0) {
      const msg =
        'DigiLocker is switched off in vendor API config (no ACTIVE vendor). Enable a vendor in LOS → Masters → Vendor APIs.';
      this.logger.warn(msg);
      return {
        configured: false,
        skipReason: msg,
        ok: false,
        httpStatus: null,
        vendorBody: null,
        vendorKind: null,
      };
    }

    let last: DigilockerFetchResult | null = null;
    for (let i = 0; i < chain.length; i++) {
      const vendorKind = chain[i];
      const result = await this.initializeWithVendor(vendorKind, redirectUrl, leadId);

      if (this.isHttpOk(result) && this.hasInitPayload(result)) {
        return result;
      }

      last = result;
      const next = chain[i + 1];
      if (next) {
        this.logger.warn(
          `DigiLocker init via ${vendorKind} failed (leadId=${leadId?.toString() ?? 'n/a'}): ` +
            `configured=${result.configured} http=${result.httpStatus ?? 'n/a'} — falling back to ${next}.`,
        );
      }
    }

    return last as DigilockerFetchResult;
  }

  /**
   * Download Aadhaar with the vendor that owns `sessionToken`.
   * No cross-vendor fallback — tokens are vendor-specific.
   */
  async downloadAadhaar(
    sessionToken: string,
    leadId: bigint | null,
    preferredVendor?: DigilockerVendorKind | null,
  ): Promise<DigilockerFetchResult> {
    const vendorKind =
      preferredVendor ??
      (sessionToken.trim().toLowerCase().startsWith('digilocker_')
        ? 'surepass'
        : await this.resolvePrimaryVendor());

    return this.downloadAadhaarWithVendor(vendorKind, sessionToken, leadId);
  }

  /** Surepass-only: download PAN document + parse certificate XML from `download_url`. */
  async downloadPan(
    clientId: string,
    leadId: bigint | null,
  ): Promise<DigilockerPanFetchResult> {
    const out = await this.surepassDigilocker.downloadPan(clientId, leadId);
    return {
      configured: out.configured,
      skipReason: out.skipReason,
      ok: out.ok,
      httpStatus: out.httpStatus,
      vendorBody: out.vendorBody,
      error: out.error,
      vendorKind: 'surepass',
      sessionToken: clientId,
      downloadUrl: out.downloadUrl ?? null,
      panFields: out.panFields ?? null,
    };
  }

  private async initializeWithVendor(
    vendorKind: DigilockerVendorKind,
    redirectUrl: string,
    leadId: bigint | null,
  ): Promise<DigilockerFetchResult> {
    if (vendorKind === 'surepass') {
      const out = await this.surepassDigilocker.initialize(redirectUrl, leadId);
      return {
        configured: out.configured,
        skipReason: out.skipReason,
        ok: out.ok,
        httpStatus: out.httpStatus,
        vendorBody: out.vendorBody,
        error: out.error,
        vendorKind: 'surepass',
        sessionToken: out.clientId ?? null,
        digilockerLoginUrl: out.digilockerLoginUrl ?? null,
      };
    }

    const out = await this.tenacioDigilocker.postGenerateUrl(
      { input: { redirectUrl, consent: true } },
      leadId,
    );
    const vendorBody = out.vendorBody ?? null;
    return {
      configured: out.configured,
      skipReason: out.skipReason,
      ok: out.ok,
      httpStatus: out.httpStatus,
      vendorBody,
      error: out.error,
      vendorKind: 'tenacio',
      sessionToken: extractDigilockerSessionToken(vendorBody),
      digilockerLoginUrl: extractDigilockerLoginUrl(vendorBody),
    };
  }

  private async downloadAadhaarWithVendor(
    vendorKind: DigilockerVendorKind,
    sessionToken: string,
    leadId: bigint | null,
  ): Promise<DigilockerFetchResult> {
    if (vendorKind === 'surepass') {
      const out = await this.surepassDigilocker.downloadAadhaar(sessionToken, leadId);
      return {
        configured: out.configured,
        skipReason: out.skipReason,
        ok: out.ok,
        httpStatus: out.httpStatus,
        vendorBody: out.vendorBody,
        error: out.error,
        vendorKind: 'surepass',
        sessionToken,
      };
    }

    const out = await this.tenacioDigilocker.postAadhaarDownload(
      { input: { sessionToken, consent: true } },
      leadId,
    );
    return {
      configured: out.configured,
      skipReason: out.skipReason,
      ok: out.ok,
      httpStatus: out.httpStatus,
      vendorBody: out.vendorBody,
      error: out.error,
      vendorKind: 'tenacio',
      sessionToken,
    };
  }

  /** HTTP 200 only — matches the requested fallback rule. */
  private isHttpOk(result: DigilockerFetchResult): boolean {
    return result.configured && result.ok && result.httpStatus === 200;
  }

  private hasInitPayload(result: DigilockerFetchResult): boolean {
    const token =
      result.sessionToken?.trim() ||
      extractDigilockerSessionToken(result.vendorBody) ||
      '';
    const url =
      result.digilockerLoginUrl?.trim() ||
      extractDigilockerLoginUrl(result.vendorBody) ||
      '';
    return Boolean(token && url);
  }
}
