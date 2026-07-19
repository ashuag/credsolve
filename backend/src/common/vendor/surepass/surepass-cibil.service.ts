import { Injectable, Logger } from '@nestjs/common';
import { VendorApiService } from '../vendor-api.service';
import { mapSurepassCibilToTenacioEnvelope } from './surepass-cibil-to-tenacio.mapper';

/** Default Surepass CIBIL soft-pull endpoint (override via `SUREPASS_CIBIL_URL`). */
export const DEFAULT_SUREPASS_CIBIL_URL =
  'https://kyc-api.surepass.app/api/v1/credit-report-cibil/fetch-report';

export type SurepassCibilInput = {
  mobileNumber: string;
  panNumber: string;
  name: string;
  /** Surepass expects lowercase `male` / `female`. */
  gender: string;
};

type SurepassCibilRequestBody = {
  mobile: string;
  pan: string;
  name: string;
  gender: string;
  consent: 'Y';
};

export type SurepassCibilResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  /**
   * Surepass response wrapped into the Tenacio bureau envelope — the keys
   * downstream BRE rules / parsers expect. `null` only when not configured.
   */
  vendorBody: Record<string, unknown> | null;
  error?: Error;
};

/**
 * Surepass CIBIL credit-report fetch (backup vendor for `cibil_fetch`).
 *
 * Env: `SUREPASS_TOKEN` (Bearer, required) and optional `SUREPASS_CIBIL_URL`.
 * Every live call is audited via {@link VendorApiService} → `vendor_api_log`
 * (raw Surepass response is stored there); the returned `vendorBody` is the
 * Tenacio-shaped wrapper so BRE rules and the CIBIL report PDF are unaffected.
 */
@Injectable()
export class SurepassCibilService {
  private readonly logger = new Logger(SurepassCibilService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  async fetchCreditReport(
    input: SurepassCibilInput,
    leadId: bigint | null,
  ): Promise<SurepassCibilResult> {
    const token = (process.env.SUREPASS_TOKEN ?? '').trim();
    const url = (process.env.SUREPASS_CIBIL_URL ?? '').trim() || DEFAULT_SUREPASS_CIBIL_URL;
    const providerName = (process.env.SUREPASS_PROVIDER ?? 'Surepass').trim();

    if (!token) {
      const msg =
        'Surepass CIBIL is not configured. Set SUREPASS_TOKEN (Bearer token) and optionally SUREPASS_CIBIL_URL.';
      this.logger.warn(msg);
      return { configured: false, skipReason: msg, ok: false, httpStatus: null, vendorBody: null };
    }

    const body: SurepassCibilRequestBody = {
      mobile: input.mobileNumber.trim(),
      pan: input.panNumber.trim().toUpperCase(),
      name: input.name.trim(),
      gender: input.gender.trim().toLowerCase(),
      consent: 'Y',
    };

    const result = await this.vendorApi.request<unknown, SurepassCibilRequestBody>({
      providerName,
      serviceName: 'credit-report-cibil',
      method: 'POST',
      absoluteUrl: url,
      headers: { Authorization: `Bearer ${token}` },
      body,
      leadId,
    });

    const vendorBody = mapSurepassCibilToTenacioEnvelope(result.body, result.httpStatus);

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody,
      error: result.error,
    };
  }
}
