import { Injectable } from '@nestjs/common';
import {
  BureauFetchService,
  type BureauFetchResult,
  type BureauTenacioRequestBody,
} from '../../../common/vendor/bureau-fetch.service';
import type { CibilVendorFetchCheckDto } from '../dto/cibil-vendor-fetch-check.dto';

export type CibilVendorDryRunResult = {
  vendor: 'Tenacio' | 'Surepass';
  configured: boolean;
  skipReason: string | null;
  ok: boolean;
  httpStatus: number | null;
  isNewToCredit: boolean;
  serviceErrorMessage: string | null;
  errorMessage: string | null;
  /**
   * Vendor response body. For Surepass this is the Tenacio-shaped envelope
   * produced by `SurepassCibilService` (the raw Surepass response is stored
   * in `vendor_api_log`).
   */
  vendorBody: unknown | null;
};

/**
 * LOS developer tools: explicit per-vendor CIBIL soft-pull dry runs.
 * Bypasses the `vendor_api_config` primary/backup switch so each vendor can
 * be exercised directly. Calls are live and audited via `vendor_api_log`
 * (leadId is null — these runs are not tied to a lead).
 */
@Injectable()
export class LosCibilDevToolsService {
  constructor(private readonly bureauFetch: BureauFetchService) {}

  async runTenacioFetch(dto: CibilVendorFetchCheckDto): Promise<CibilVendorDryRunResult> {
    const result = await this.bureauFetch.fetchDirectFromTenacio(this.toRequestBody(dto), null);
    return this.toDryRunResult('Tenacio', result);
  }

  async runSurepassFetch(dto: CibilVendorFetchCheckDto): Promise<CibilVendorDryRunResult> {
    const result = await this.bureauFetch.fetchDirectFromSurepass(
      this.toRequestBody(dto),
      null,
      dto.gender ?? 'male',
    );
    return this.toDryRunResult('Surepass', result);
  }

  private toRequestBody(dto: CibilVendorFetchCheckDto): BureauTenacioRequestBody {
    return {
      input: {
        mobileNumber: dto.mobileNumber.trim(),
        panNumber: dto.panNumber.trim().toUpperCase(),
        name: dto.name.trim(),
        consent: dto.consent ?? true,
      },
    };
  }

  private toDryRunResult(
    vendor: CibilVendorDryRunResult['vendor'],
    result: BureauFetchResult,
  ): CibilVendorDryRunResult {
    return {
      vendor,
      configured: result.configured,
      skipReason: result.skipReason ?? null,
      ok: result.ok,
      httpStatus: result.httpStatus,
      isNewToCredit: result.isNewToCredit,
      serviceErrorMessage: result.serviceErrorMessage,
      errorMessage: result.error ? result.error.message : null,
      vendorBody: result.vendorBody,
    };
  }
}
