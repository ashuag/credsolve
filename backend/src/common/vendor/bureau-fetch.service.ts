import { Injectable, Logger } from '@nestjs/common';
import { readBureauFetchMode } from '../constants/bureau-fetch-settings.util';
import { VENDOR_API_CODE } from '../constants/vendor-api-config.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { extractVendorServiceError } from './vendor-api-error.util';
import { isTenacioBureauSuccessPayload } from './tenacio-bureau-payload.mapper';
import { TENACIO_BUREAU_MOCK_VENDOR_BODY } from './tenacio-bureau-mock.fixture';
import { SurepassCibilService } from './surepass/surepass-cibil.service';
import { Cibil07CibilService } from './cibil07/cibil07-cibil.service';
import { VendorApiService } from './vendor-api.service';
import { VendorApiConfigService } from './vendor-api-config.service';
import { type CibilVendorKind, mapCibilVendorName } from './cibil-vendor.util';
import { formatBureauInquiryName } from '../utils/person-name.util';

export type { CibilVendorKind } from './cibil-vendor.util';
export { mapCibilVendorName } from './cibil-vendor.util';

/**
 * Default relative path when `VENDOR_HOST` is `…/api/v1/services` and
 * `TENACIO_CIBIL_URL` is not set (path appended to `VENDOR_HOST`).
 * Prefer `TENACIO_CIBIL_URL` with the full HTTPS URL if joining is error-prone.
 */
export const TENACIO_BUREAU_SOFT_PULL_SERVICE = 'experian-soft-pull/services/experian-soft-pull';

export type BureauTenacioInput = {
  mobileNumber: string;
  name: string;
  panNumber: string;
  consent: boolean;
};

export type BureauTenacioRequestBody = {
  input: BureauTenacioInput;
};

export type BureauFetchResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
  error?: Error;
  /** True when `BUREAU_FETCH_ENABLED=2` (mock fixture); persist on `bureau_report.dummy_fetched`. */
  dummyPayload: boolean;
  /**
   * True when the bureau processed the request but returned a client-side
   * (4xx) service error — i.e. it has no matching credit record for this
   * identity (e.g. `serviceStatusCode: 422`, "Authentication required.
   * Please provide mobile number registered with bureau records."). The
   * caller should treat such customers as New-To-Credit and reject the lead.
   */
  isNewToCredit: boolean;
  /** Vendor `serviceError.message` when present (for audit notes). */
  serviceErrorMessage: string | null;
  /** Integration that produced this result (`null` when no vendor was attempted). */
  vendorKind: CibilVendorKind | null;
};

/**
 * Tenacio bureau pull (Experian/CIBIL workflow) using env `VENDOR_HOST`, `TENACIO_CLIENT_ID` (sent as HTTP
 * `client-id`), `TENACIO_API_KEY` (sent as HTTP `x-api-key`). Path and `workflow-id` use `TENACIO_CIBIL_*`.
 * Every live call is audited via {@link VendorApiService} → `vendor_api_log`.
 */
@Injectable()
export class BureauFetchService {
  private readonly logger = new Logger(BureauFetchService.name);

  constructor(
    private readonly vendorApi: VendorApiService,
    private readonly vendorApiConfig: VendorApiConfigService,
    private readonly surepassCibil: SurepassCibilService,
    private readonly cibil07Cibil: Cibil07CibilService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Bureau soft-pull with vendor fallback. Vendors come from `vendor_api_config`
   * (`cibil_fetch`, ACTIVE rows ordered by priority — Tenacio primary, Surepass
   * backup by default). The primary vendor is called first; on any error
   * (not configured, transport failure, non-200 HTTP, or a vendor service
   * error such as a 4xx no-hit), the next vendor is tried. Surepass responses
   * are wrapped into the Tenacio envelope so BRE rules are unaffected.
   *
   * Tenacio POST uses `TENACIO_CIBIL_URL` when set (full URL), otherwise
   * `${VENDOR_HOST}/${path}` with path from `TENACIO_CIBIL_SERVICE` or
   * {@link TENACIO_BUREAU_SOFT_PULL_SERVICE}.
   */
  async fetchBureauFromTenacio(
    body: BureauTenacioRequestBody,
    leadId: bigint | null,
  ): Promise<BureauFetchResult> {
    const bureauMode = await readBureauFetchMode(this.prisma.client);
    if (bureauMode === 2) {
      this.logger.debug(
        `Tenacio bureau skipped (mock): BUREAU_FETCH_ENABLED=2 leadId=${leadId?.toString() ?? 'n/a'}`,
      );
      return {
        configured: true,
        ok: true,
        httpStatus: 200,
        vendorBody: structuredClone(TENACIO_BUREAU_MOCK_VENDOR_BODY),
        dummyPayload: true,
        isNewToCredit: false,
        serviceErrorMessage: null,
        vendorKind: 'tenacio',
      };
    }

    const vendorChain = await this.resolveCibilVendorChain();
    if (vendorChain.length === 0) {
      const msg =
        'CIBIL fetch is switched off in vendor API config (no ACTIVE vendor). Enable a vendor in LOS → Masters → Vendor APIs.';
      this.logger.warn(msg);
      return {
        configured: false,
        skipReason: msg,
        ok: false,
        httpStatus: null,
        vendorBody: null,
        dummyPayload: false,
        isNewToCredit: false,
        serviceErrorMessage: null,
        vendorKind: null,
      };
    }

    let lastResult: BureauFetchResult | null = null;
    for (let i = 0; i < vendorChain.length; i++) {
      const vendor = vendorChain[i];
      const result = {
        ...(vendor === 'surepass'
          ? await this.fetchBureauFromSurepass(body, leadId)
          : vendor === 'cibil07'
            ? await this.fetchBureauFromCibil07(body, leadId)
            : await this.fetchDirectFromTenacio(body, leadId)),
        vendorKind: vendor,
      };

      if (this.isBureauFetchSuccess(result)) {
        return result;
      }

      lastResult = this.pickWorseCaseResult(lastResult, result);

      const nextVendor = vendorChain[i + 1];
      if (nextVendor) {
        this.logger.warn(
          `Bureau pull via ${vendor} failed (leadId=${leadId?.toString() ?? 'n/a'}): ` +
            `configured=${result.configured} http=${result.httpStatus ?? 'n/a'} ` +
            `serviceError=${result.serviceErrorMessage ?? result.error?.message ?? 'n/a'} — ` +
            `falling back to ${nextVendor}.`,
        );
      }
    }

    // All vendors failed — lastResult holds the most meaningful failure.
    return lastResult as BureauFetchResult;
  }

  /**
   * ACTIVE `cibil_fetch` vendors ordered by priority, mapped to the supported
   * integrations. Defaults to Tenacio → Surepass when no `vendor_api_config`
   * rows exist for `cibil_fetch`.
   */
  private async resolveCibilVendorChain(): Promise<CibilVendorKind[]> {
    const hasCibilConfig = await this.vendorApiConfig.hasAnyForApi(VENDOR_API_CODE.CIBIL_FETCH);
    if (!hasCibilConfig) return ['tenacio', 'surepass'];

    const activeVendors = await this.vendorApiConfig.listActive(VENDOR_API_CODE.CIBIL_FETCH);
    const chain: CibilVendorKind[] = [];
    for (const row of activeVendors) {
      const kind = mapCibilVendorName(row.vendorName);
      if (!chain.includes(kind)) chain.push(kind);
    }
    return chain;
  }

  /**
   * A pull counts as successful only when the vendor returned HTTP 200 with a
   * Tenacio-shaped success payload (bureau score / cibilData present, no
   * service error). Anything else — misconfiguration, transport error,
   * non-200 HTTP, or a 4xx/5xx `serviceStatusCode` — triggers the fallback.
   */
  private isBureauFetchSuccess(result: BureauFetchResult): boolean {
    return (
      result.configured &&
      result.ok &&
      result.httpStatus === 200 &&
      result.vendorBody != null &&
      isTenacioBureauSuccessPayload(result.vendorBody)
    );
  }

  /**
   * When every vendor fails, return the most meaningful result: a configured
   * attempt beats a not-configured skip, and a definitive New-To-Credit
   * bureau answer beats a technical error from a later vendor.
   */
  private pickWorseCaseResult(
    previous: BureauFetchResult | null,
    current: BureauFetchResult,
  ): BureauFetchResult {
    if (!previous) return current;
    if (previous.configured && !current.configured) return previous;
    if (!previous.configured && current.configured) return current;
    if (previous.isNewToCredit && !current.isNewToCredit) return previous;
    return current;
  }

  /**
   * Tenacio bureau pull without the vendor_api_config switch — used by the
   * normal flow after vendor resolution and by the LOS developer tool that
   * targets Tenacio explicitly.
   */
  async fetchDirectFromTenacio(
    body: BureauTenacioRequestBody,
    leadId: bigint | null,
  ): Promise<BureauFetchResult> {
    const fullBureauUrl = (process.env.TENACIO_CIBIL_URL ?? '').trim();
    const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
    const clientId = (process.env.TENACIO_CLIENT_ID ?? '').trim();
    const apiKey = (process.env.TENACIO_API_KEY ?? '').trim();
    const workflowId = (process.env.TENACIO_CIBIL_WORKFLOW_ID ?? '').trim();
    const serviceSlug =
      (process.env.TENACIO_CIBIL_SERVICE ?? '').trim() || TENACIO_BUREAU_SOFT_PULL_SERVICE;
    const auditServiceName = (
      process.env.TENACIO_CIBIL_AUDIT_SERVICE ??
      (fullBureauUrl ? 'experian-soft-pull' : serviceSlug)
    ).trim();
    const providerName = (process.env.TENACIO_PROVIDER ?? 'Tenacio').trim();

    if (!clientId || !apiKey || !workflowId) {
      const msg =
        'Tenacio bureau is not configured. Set TENACIO_CLIENT_ID, TENACIO_API_KEY, TENACIO_CIBIL_WORKFLOW_ID (bureau `workflow-id` header), and TENACIO_CIBIL_URL (recommended) or VENDOR_HOST.';
      this.logger.warn(msg);
      return {
        configured: false,
        skipReason: msg,
        ok: false,
        httpStatus: null,
        vendorBody: null,
        dummyPayload: false,
        isNewToCredit: false,
        serviceErrorMessage: null,
        vendorKind: 'tenacio',
      };
    }

    if (!fullBureauUrl && !baseUrl) {
      const msg =
        'Tenacio bureau is not configured. Set TENACIO_CIBIL_URL to the full bureau POST URL, or set VENDOR_HOST and optional TENACIO_CIBIL_SERVICE.';
      this.logger.warn(msg);
      return {
        configured: false,
        skipReason: msg,
        ok: false,
        httpStatus: null,
        vendorBody: null,
        dummyPayload: false,
        isNewToCredit: false,
        serviceErrorMessage: null,
        vendorKind: 'tenacio',
      };
    }

    const normalizedBody: BureauTenacioRequestBody = {
      input: {
        ...body.input,
        panNumber: body.input.panNumber.trim().toUpperCase(),
        mobileNumber: body.input.mobileNumber.trim(),
        name: formatBureauInquiryName(body.input.name),
        consent: body.input.consent,
      },
    };

    const result = await this.vendorApi.request<unknown, BureauTenacioRequestBody>({
      providerName,
      serviceName: auditServiceName.slice(0, 120),
      method: 'POST',
      ...(fullBureauUrl
        ? { absoluteUrl: fullBureauUrl }
        : { baseUrl, path: serviceSlug }),
      headers: {
        'client-id': clientId,
        'x-api-key': apiKey,
        'workflow-id': workflowId,
      },
      body: normalizedBody,
      leadId,
    });

    // A processed-but-failed bureau pull with a client-side (4xx) service status
    // means the bureau holds no matching record for this identity → treat the
    // customer as New-To-Credit. 5xx service codes are vendor outages and are
    // handled as internal errors elsewhere, so they are excluded here.
    const serviceError = extractVendorServiceError(result.body);
    const isNewToCredit =
      serviceError != null &&
      (serviceError.serviceStatusCode == null || serviceError.serviceStatusCode < 500);

    if (serviceError) {
      this.logger.warn(
        `Tenacio bureau service error (leadId=${leadId?.toString() ?? 'n/a'}): ` +
          `serviceStatusCode=${serviceError.serviceStatusCode ?? 'n/a'} ntc=${isNewToCredit} ` +
          `message=${serviceError.message ?? 'n/a'}`,
      );
    }

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody: result.body,
      error: result.error,
      dummyPayload: false,
      isNewToCredit,
      serviceErrorMessage: serviceError?.message ?? null,
      vendorKind: 'tenacio',
    };
  }

  /**
   * Surepass backup path. The raw Surepass response is wrapped into the
   * Tenacio envelope by `SurepassCibilService`, so the New-To-Credit
   * classification below and every downstream consumer (BRE rules, tradeline
   * exposure, CIBIL report PDF) work unchanged.
   */
  async fetchDirectFromSurepass(
    body: BureauTenacioRequestBody,
    leadId: bigint | null,
    genderOverride?: string,
  ): Promise<BureauFetchResult> {
    return this.fetchBureauFromSurepass(body, leadId, genderOverride);
  }

  private async fetchBureauFromSurepass(
    body: BureauTenacioRequestBody,
    leadId: bigint | null,
    genderOverride?: string,
  ): Promise<BureauFetchResult> {
    const gender =
      genderOverride?.trim().toLowerCase() || (await this.resolveLeadGenderForSurepass(leadId));

    const result = await this.surepassCibil.fetchCreditReport(
      {
        mobileNumber: body.input.mobileNumber,
        panNumber: body.input.panNumber,
        name: formatBureauInquiryName(body.input.name),
        gender,
      },
      leadId,
    );

    if (!result.configured) {
      return {
        configured: false,
        skipReason: result.skipReason,
        ok: false,
        httpStatus: null,
        vendorBody: null,
        dummyPayload: false,
        isNewToCredit: false,
        serviceErrorMessage: null,
        vendorKind: 'surepass',
      };
    }

    const serviceError = extractVendorServiceError(result.vendorBody);
    const isNewToCredit =
      serviceError != null &&
      (serviceError.serviceStatusCode == null || serviceError.serviceStatusCode < 500);

    if (serviceError) {
      this.logger.warn(
        `Surepass bureau service error (leadId=${leadId?.toString() ?? 'n/a'}): ` +
          `serviceStatusCode=${serviceError.serviceStatusCode ?? 'n/a'} ntc=${isNewToCredit} ` +
          `message=${serviceError.message ?? 'n/a'}`,
      );
    }

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody: result.vendorBody,
      error: result.error,
      dummyPayload: false,
      isNewToCredit,
      serviceErrorMessage: serviceError?.message ?? null,
      vendorKind: 'surepass',
    };
  }

  /**
   * CIBIL07 bureau path — CIBIL07 API `POST /api/cibil/soft-pull`
   * (PayMe India merchant). `Cibil07CibilService` reads name / DOB /
   * gender / email / pincode / address from `lead_detail` and wraps the raw
   * soft-pull response into the Tenacio envelope, so the New-To-Credit
   * classification below and every downstream consumer work unchanged.
   */
  async fetchDirectFromCibil07(
    body: BureauTenacioRequestBody,
    leadId: bigint | null,
  ): Promise<BureauFetchResult> {
    return this.fetchBureauFromCibil07(body, leadId);
  }

  private async fetchBureauFromCibil07(
    body: BureauTenacioRequestBody,
    leadId: bigint | null,
  ): Promise<BureauFetchResult> {
    const result = await this.cibil07Cibil.fetchCreditReport(
      {
        mobileNumber: body.input.mobileNumber,
        panNumber: body.input.panNumber,
        name: body.input.name,
        consent: body.input.consent,
      },
      leadId,
    );

    if (!result.configured) {
      return {
        configured: false,
        skipReason: result.skipReason,
        ok: false,
        httpStatus: null,
        vendorBody: null,
        dummyPayload: false,
        isNewToCredit: false,
        serviceErrorMessage: null,
        vendorKind: 'cibil07',
      };
    }

    const serviceError = extractVendorServiceError(result.vendorBody);
    const isNewToCredit =
      serviceError != null &&
      (serviceError.serviceStatusCode == null || serviceError.serviceStatusCode < 500);

    if (serviceError) {
      this.logger.warn(
        `CIBIL07 bureau service error (leadId=${leadId?.toString() ?? 'n/a'}): ` +
          `serviceStatusCode=${serviceError.serviceStatusCode ?? 'n/a'} ntc=${isNewToCredit} ` +
          `message=${serviceError.message ?? 'n/a'}`,
      );
    }

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody: result.vendorBody,
      error: result.error,
      dummyPayload: false,
      isNewToCredit,
      serviceErrorMessage: serviceError?.message ?? null,
      vendorKind: 'cibil07',
    };
  }

  /**
   * Surepass requires a lowercase `gender` in the request. Read it from the
   * lead detail (captured in the customer journey before the bureau pull);
   * default to `male` when unavailable — the bureau matches primarily on
   * PAN + mobile, gender is an auxiliary hint.
   */
  private async resolveLeadGenderForSurepass(leadId: bigint | null): Promise<string> {
    if (leadId == null) return 'male';
    try {
      const detail = await this.prisma.client.leadDetail.findUnique({
        where: { leadId },
        select: { gender: { select: { key: true } } },
      });
      const key = detail?.gender?.key?.trim().toUpperCase();
      if (key === 'FEMALE') return 'female';
      return 'male';
    } catch (err) {
      this.logger.warn(
        `Could not resolve lead gender for Surepass (leadId=${leadId.toString()}): ${String(err)}`,
      );
      return 'male';
    }
  }
}
