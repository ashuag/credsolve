import { Injectable, Logger } from '@nestjs/common';
import { VendorApiService } from '../vendor-api.service';
import {
  extractPanXmlFileIdFromListDocuments,
  mapSurepassDigilockerAadhaarToFormEnvelope,
  mapSurepassDigilockerInitToSessionFields,
  parseDigilockerPanCertificateXml,
  type DigilockerPanCertificateFields,
} from './surepass-digilocker.mapper';

/** Default Surepass DigiLocker endpoints (override via `SUREPASS_DIGILOCKER_*_URL`). */
export const DEFAULT_SUREPASS_DIGILOCKER_INIT_URL =
  'https://kyc-api.surepass.app/api/v1/digilocker/initialize';
export const DEFAULT_SUREPASS_DIGILOCKER_AADHAAR_BASE_URL =
  'https://kyc-api.surepass.app/api/v1/digilocker/download-aadhaar';
export const DEFAULT_SUREPASS_DIGILOCKER_LIST_DOCUMENTS_BASE_URL =
  'https://kyc-api.surepass.app/api/v1/digilocker/list-documents';
export const DEFAULT_SUREPASS_DIGILOCKER_PAN_BASE_URL =
  'https://kyc-api.surepass.app/api/v1/digilocker/download-document';

const DEFAULT_LOGO_URL =
  'https://www.moneycash.in/_next/image?url=%2Fimages%2Fmoneycash-logo.png&w=256&q=95';

export type SurepassDigilockerCallResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
  error?: Error;
  /** Surepass `client_id` — used as DigiLocker session token downstream. */
  clientId?: string | null;
  digilockerLoginUrl?: string | null;
};

export type SurepassDigilockerPanResult = SurepassDigilockerCallResult & {
  downloadUrl?: string | null;
  panFields?: DigilockerPanCertificateFields | null;
};

type SurepassInitBody = {
  data: {
    signup_flow: true;
    logo_url: string;
    redirect_url: string;
    skip_main_screen: boolean;
  };
};

/**
 * Surepass DigiLocker: initialize → download Aadhaar → list-documents → download PAN XML.
 *
 * Env: `SUREPASS_TOKEN` (Bearer, required). Optional:
 * - `SUREPASS_DIGILOCKER_INIT_URL`
 * - `SUREPASS_DIGILOCKER_AADHAAR_URL` (base; `/{client_id}` appended)
 * - `SUREPASS_DIGILOCKER_LIST_DOCUMENTS_URL` (base; `/{client_id}` appended)
 * - `SUREPASS_DIGILOCKER_PAN_URL` (base; `/{client_id}/{file_id}` appended)
 * - `SUREPASS_DIGILOCKER_LOGO_URL`
 * - `SUREPASS_DIGILOCKER_REDIRECT_URL` — when set, always sent as Surepass `redirect_url`
 *   (overrides client / portal callback; use a public HTTPS URL — localhost is rejected by Surepass)
 * - `SUREPASS_PROVIDER`
 */
@Injectable()
export class SurepassDigilockerService {
  private readonly logger = new Logger(SurepassDigilockerService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  async initialize(
    redirectUrl: string,
    leadId: bigint | null,
  ): Promise<SurepassDigilockerCallResult> {
    const auth = this.resolveAuth();
    if (!auth) return this.authMissing();

    const url =
      (process.env.SUREPASS_DIGILOCKER_INIT_URL ?? '').trim() || DEFAULT_SUREPASS_DIGILOCKER_INIT_URL;
    const logoUrl =
      (process.env.SUREPASS_DIGILOCKER_LOGO_URL ?? '').trim() || DEFAULT_LOGO_URL;
    const surepassRedirect = this.resolveRedirectUrl(redirectUrl);

    const body: SurepassInitBody = {
      data: {
        signup_flow: true,
        logo_url: logoUrl,
        redirect_url: surepassRedirect,
        skip_main_screen: false,
      },
    };

    const result = await this.vendorApi.request<unknown, SurepassInitBody>({
      providerName: auth.providerName,
      serviceName: 'digilocker-initialize',
      method: 'POST',
      absoluteUrl: url,
      headers: { Authorization: `Bearer ${auth.token}` },
      body,
      leadId,
    });

    const vendorBody = result.body ?? this.unparsedBody(result);
    const fields = mapSurepassDigilockerInitToSessionFields(vendorBody);

    // Surepass edge returns bare nginx "403 Forbidden" HTML when redirect_url uses
    // localhost / 127.0.0.1. Prefer SUREPASS_DIGILOCKER_REDIRECT_URL for local/dev.
    const localhostRedirectBlocked =
      !result.ok &&
      result.httpStatus === 403 &&
      isLoopbackOrLocalhostUrl(surepassRedirect);
    if (localhostRedirectBlocked) {
      const msg =
        'Surepass DigiLocker rejected redirect_url: localhost / 127.0.0.1 callbacks are blocked (HTTP 403). ' +
        'Set SUREPASS_DIGILOCKER_REDIRECT_URL to a public HTTPS callback (e.g. https://www.moneycash.in/kyc/digilocker-callback).';
      this.logger.warn(`${msg} redirect_url=${surepassRedirect}`);
      return {
        configured: true,
        ok: false,
        httpStatus: result.httpStatus,
        vendorBody: {
          message: msg,
          redirect_url: surepassRedirect,
          ...(typeof vendorBody === 'object' && vendorBody ? vendorBody : {}),
        },
        error: new Error(msg),
        clientId: fields.clientId,
        digilockerLoginUrl: fields.url,
      };
    }

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody,
      error: result.error,
      clientId: fields.clientId,
      digilockerLoginUrl: fields.url,
    };
  }

  async downloadAadhaar(
    clientId: string,
    leadId: bigint | null,
  ): Promise<SurepassDigilockerCallResult> {
    const auth = this.resolveAuth();
    if (!auth) return this.authMissing();

    const id = clientId.trim();
    if (!id) {
      return this.fail('Surepass DigiLocker Aadhaar download requires client_id (session token).');
    }

    const base =
      (process.env.SUREPASS_DIGILOCKER_AADHAAR_URL ?? '').trim() ||
      DEFAULT_SUREPASS_DIGILOCKER_AADHAAR_BASE_URL;
    const absoluteUrl = `${base.replace(/\/+$/, '')}/${encodeURIComponent(id)}`;

    const result = await this.vendorApi.request<unknown>({
      providerName: auth.providerName,
      serviceName: 'digilocker-download-aadhaar',
      method: 'GET',
      absoluteUrl,
      headers: { Authorization: `Bearer ${auth.token}` },
      leadId,
    });

    const vendorBody = mapSurepassDigilockerAadhaarToFormEnvelope(
      result.body ?? this.unparsedBody(result),
    );

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody,
      error: result.error,
      clientId: id,
    };
  }

  /**
   * Lists DigiLocker documents, selects PAN XML (`doc_type=PANCR`, `file_type=xml`),
   * downloads that document, then fetches `download_url` XML and parses certificate
   * fields (PAN number, name, DOB, gender).
   */
  async downloadPan(
    clientId: string,
    leadId: bigint | null,
  ): Promise<SurepassDigilockerPanResult> {
    const auth = this.resolveAuth();
    if (!auth) return this.authMissing();

    const id = clientId.trim();
    if (!id) {
      return this.fail('Surepass DigiLocker PAN download requires client_id (session token).');
    }

    const listResult = await this.listDocuments(id, auth, leadId);
    if (!listResult.ok) {
      return {
        configured: true,
        ok: false,
        httpStatus: listResult.httpStatus,
        vendorBody: listResult.vendorBody,
        error: listResult.error,
        clientId: id,
        downloadUrl: null,
        panFields: null,
      };
    }

    const panFileId = extractPanXmlFileIdFromListDocuments(listResult.vendorBody);
    if (!panFileId) {
      const msg =
        'Surepass DigiLocker list-documents did not return a PAN XML file (doc_type=PANCR, file_type=xml).';
      this.logger.warn(msg);
      return {
        configured: true,
        ok: false,
        httpStatus: listResult.httpStatus,
        vendorBody: listResult.vendorBody,
        error: new Error(msg),
        clientId: id,
        downloadUrl: null,
        panFields: null,
      };
    }

    const base =
      (process.env.SUREPASS_DIGILOCKER_PAN_URL ?? '').trim() ||
      DEFAULT_SUREPASS_DIGILOCKER_PAN_BASE_URL;
    const absoluteUrl = `${base.replace(/\/+$/, '')}/${encodeURIComponent(id)}/${encodeURIComponent(panFileId)}`;

    const result = await this.vendorApi.request<unknown>({
      providerName: auth.providerName,
      serviceName: 'digilocker-download-pan',
      method: 'GET',
      absoluteUrl,
      headers: { Authorization: `Bearer ${auth.token}` },
      leadId,
    });

    const vendorBody = result.body ?? this.unparsedBody(result);
    const downloadUrl = this.extractDownloadUrl(vendorBody);

    if (!result.ok || !downloadUrl) {
      return {
        configured: true,
        ok: result.ok,
        httpStatus: result.httpStatus,
        vendorBody,
        error: result.error,
        clientId: id,
        downloadUrl: downloadUrl ?? null,
        panFields: null,
      };
    }

    let panFields: DigilockerPanCertificateFields | null = null;
    try {
      panFields = await this.fetchAndParsePanXml(downloadUrl, auth.providerName, leadId);
    } catch (err) {
      this.logger.warn(
        `Surepass DigiLocker PAN XML fetch/parse failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        configured: true,
        ok: false,
        httpStatus: result.httpStatus,
        vendorBody,
        error: err instanceof Error ? err : new Error(String(err)),
        clientId: id,
        downloadUrl,
        panFields: null,
      };
    }

    return {
      configured: true,
      ok: true,
      httpStatus: result.httpStatus,
      vendorBody,
      error: result.error,
      clientId: id,
      downloadUrl,
      panFields,
    };
  }

  private async listDocuments(
    clientId: string,
    auth: { token: string; providerName: string },
    leadId: bigint | null,
  ): Promise<SurepassDigilockerCallResult> {
    const base =
      (process.env.SUREPASS_DIGILOCKER_LIST_DOCUMENTS_URL ?? '').trim() ||
      DEFAULT_SUREPASS_DIGILOCKER_LIST_DOCUMENTS_BASE_URL;
    const absoluteUrl = `${base.replace(/\/+$/, '')}/${encodeURIComponent(clientId)}`;

    const result = await this.vendorApi.request<unknown>({
      providerName: auth.providerName,
      serviceName: 'digilocker-list-documents',
      method: 'GET',
      absoluteUrl,
      headers: { Authorization: `Bearer ${auth.token}` },
      leadId,
    });

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody: result.body ?? this.unparsedBody(result),
      error: result.error,
      clientId,
    };
  }

  private async fetchAndParsePanXml(
    downloadUrl: string,
    providerName: string,
    leadId: bigint | null,
  ): Promise<DigilockerPanCertificateFields> {
    const result = await this.vendorApi.request<unknown>({
      providerName,
      serviceName: 'digilocker-pan-xml',
      method: 'GET',
      absoluteUrl: downloadUrl,
      leadId,
      timeoutMs: 45_000,
    });

    const xml =
      typeof result.rawText === 'string' && result.rawText.trim()
        ? result.rawText
        : typeof result.body === 'string'
          ? result.body
          : null;

    if (!result.ok || !xml) {
      throw new Error(
        `PAN XML download failed (HTTP ${result.httpStatus ?? 'n/a'}).`,
      );
    }

    return parseDigilockerPanCertificateXml(xml);
  }

  private extractDownloadUrl(vendor: unknown): string | null {
    if (!vendor || typeof vendor !== 'object' || Array.isArray(vendor)) return null;
    const root = vendor as Record<string, unknown>;
    const data = root.data;
    const bag = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : root;
    for (const key of ['download_url', 'downloadUrl', 'url'] as const) {
      const v = bag[key];
      if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
    }
    return null;
  }

  private resolveAuth(): { token: string; providerName: string } | null {
    const token = (process.env.SUREPASS_TOKEN ?? '').trim();
    if (!token) return null;
    return {
      token,
      providerName: (process.env.SUREPASS_PROVIDER ?? 'Surepass').trim(),
    };
  }

  /**
   * Surepass `redirect_url`: `SUREPASS_DIGILOCKER_REDIRECT_URL` wins when set
   * (local apps still send localhost; Surepass rejects that).
   */
  private resolveRedirectUrl(clientOrPortalRedirect: string): string {
    const fromEnv = (process.env.SUREPASS_DIGILOCKER_REDIRECT_URL ?? '').trim();
    if (fromEnv) {
      if (fromEnv !== clientOrPortalRedirect) {
        this.logger.debug(
          `Surepass DigiLocker using SUREPASS_DIGILOCKER_REDIRECT_URL (ignored caller redirect=${clientOrPortalRedirect})`,
        );
      }
      return fromEnv;
    }
    return clientOrPortalRedirect;
  }

  private authMissing(): SurepassDigilockerCallResult {
    const msg =
      'Surepass DigiLocker is not configured. Set SUREPASS_TOKEN (Bearer token).';
    this.logger.warn(msg);
    return { configured: false, skipReason: msg, ok: false, httpStatus: null, vendorBody: null };
  }

  private fail(skipReason: string): SurepassDigilockerCallResult {
    this.logger.warn(skipReason);
    return { configured: false, skipReason, ok: false, httpStatus: null, vendorBody: null };
  }

  private unparsedBody(result: {
    httpStatus: number | null;
    rawText?: string;
  }): Record<string, unknown> | null {
    if (!result.rawText) return null;
    return {
      _unparsedResponse: true,
      httpStatus: result.httpStatus,
      body: result.rawText.slice(0, 32_000),
    };
  }
}

/** True when hostname is loopback / literal localhost (Surepass DigiLocker init rejects these). */
function isLoopbackOrLocalhostUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return /localhost|127\.0\.0\.1/i.test(raw);
  }
}
