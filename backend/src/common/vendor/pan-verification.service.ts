import { Injectable, Logger } from '@nestjs/common';
import { PAN_VERIFIED, type PanVerifiedStatus } from '../constants/pan-verification.constants';
import { VendorApiService } from './vendor-api.service';

/** Convert ISO `YYYY-MM-DD` to vendor's `DD-MM-YYYY` body format. */
function formatDobDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

// ── Vendor request / response shapes ─────────────────────────────────────

type TenacioNsdlBody = {
  input: {
    panNumber: string;
    name: string;
    dob: string;
    consent: boolean;
  };
};

type TenacioNsdlResponseData = {
  panNumber?: string;
  panStatus?: string;
  nameMatch?: boolean;
  dobMatch?: boolean;
  category?: string;
  aadhaarSeedingStatus?: boolean;
  aadhaarLinked?: boolean | null;
};

type TenacioNsdlResponse = {
  status?: string;
  requestId?: string;
  type?: string;
  serviceStatusCode?: number;
  data?: TenacioNsdlResponseData | null;
  vendorResponse?: Array<{ name?: string; sequence?: number; statusCode?: number }>;
  success?: boolean;
  statusCode?: number;
  message?: string;
};

// ── Public result type ───────────────────────────────────────────────────

export type PanVerificationResult = {
  /**
   * SmallInt for `lead_detail.pan_verified`:
   *   0 = NOT_CHECKED (transient failure, safe to retry)
   *   1 = VERIFIED
   *   2 = NOT_VERIFIED (definitive negative from vendor)
   *   3 = API_FAILURE (vendor returned success=false)
   *   4 = API_DISABLED (setting turned off)
   */
  panVerifiedStatus: PanVerifiedStatus;
  nameMatch: boolean;
  dobMatch: boolean;
  panStatus: string | null;
  category: string | null;
  vendorRequestId: string | null;
  /** Human-readable summary stored on `lead.lead_status_note` after verification. */
  note: string | null;
};

export type PanVerificationInput = {
  leadId: bigint;
  panNumber: string;
  fullName: string;
  dobIso: string;
};

/**
 * Shared PAN verification via Tenacio NSDL. Inject in any module (customer
 * onboarding, LOS, admin, etc.) — the service is registered globally via
 * `VendorApiModule`.
 *
 * **Error strategy:**
 * - Vendor returns HTTP error / network failure / missing creds →
 *   `panVerifiedStatus = 0` (NOT_CHECKED). The caller should keep the DB
 *   value at 0 so the check can be retried later.
 * - Vendor returns a success response with panStatus=valid + all matches →
 *   `panVerifiedStatus = 1` (VERIFIED).
 * - Vendor returns a success response but PAN invalid / mismatches →
 *   `panVerifiedStatus = 2` (NOT_VERIFIED).
 */
@Injectable()
export class PanVerificationService {
  private readonly logger = new Logger(PanVerificationService.name);

  constructor(private readonly vendorApi: VendorApiService) {}

  /**
   * Client-side PAN structural check before hitting the vendor:
   * - Must be 10 chars: 5 alpha, 4 numeric, 1 alpha
   * - 4th character must be 'P' (individual PAN)
   * - 5th character must match the first letter of the last word in fullName
   */
  validatePanStructure(pan: string, fullName: string): { valid: boolean; note: string } {
    const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!PAN_REGEX.test(pan)) {
      return { valid: false, note: 'Invalid PAN format' };
    }
    if (pan[3] !== 'P') {
      return { valid: false, note: `PAN 4th character must be P (individual PAN), got '${pan[3]}'` };
    }
    const nameParts = fullName.trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (nameParts.length === 0) {
      return { valid: false, note: 'Full name is required for PAN validation' };
    }
    const lastNameInitial = nameParts[nameParts.length - 1]![0]!;
    if (pan[4] !== lastNameInitial) {
      return {
        valid: false,
        note: `PAN 5th character '${pan[4]}' does not match last name initial '${lastNameInitial}'`,
      };
    }
    return { valid: true, note: '' };
  }

  async verify(input: PanVerificationInput): Promise<PanVerificationResult> {
    const structCheck = this.validatePanStructure(input.panNumber, input.fullName);
    if (!structCheck.valid) {
      this.logger.warn(
        `PAN structural validation failed (leadId=${input.leadId.toString()}): ${structCheck.note}`,
      );
      return {
        panVerifiedStatus: PAN_VERIFIED.NOT_VERIFIED,
        nameMatch: false,
        dobMatch: false,
        panStatus: 'invalid',
        category: null,
        vendorRequestId: null,
        note: structCheck.note,
      };
    }

    return this.verifyWithVendor(input);
  }

  /** Calls Tenacio NSDL only — run `validatePanStructure` first when checks are ordered separately. */
  async verifyWithVendor(input: PanVerificationInput): Promise<PanVerificationResult> {
    const notChecked: PanVerificationResult = {
      panVerifiedStatus: PAN_VERIFIED.NOT_CHECKED,
      nameMatch: false,
      dobMatch: false,
      panStatus: null,
      category: null,
      vendorRequestId: null,
      note: null,
    };

    try {
      const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
      const clientId = (process.env.TENACIO_CLIENT_ID ?? '').trim();
      const apiKey = (process.env.TENACIO_API_KEY ?? '').trim();
      const workflowId = (process.env.TENACIO_PAN_NSDL_WORKFLOW_ID ?? '').trim();
      const logger = new Logger(PanVerificationService.name);
      if (!baseUrl || !clientId || !apiKey || !workflowId) {
        this.logger.warn(
          'Tenacio credentials missing — skipping PAN verification. Set VENDOR_HOST, TENACIO_CLIENT_ID, TENACIO_API_KEY, TENACIO_PAN_NSDL_WORKFLOW_ID.',
        );
        return { ...notChecked, note: 'Vendor credentials not configured' };
      }

      const serviceName = (process.env.TENACIO_PAN_NSDL_SERVICE ?? '').trim();
      const providerName = (process.env.TENACIO_PROVIDER ?? '').trim();

      const result = await this.vendorApi.request<TenacioNsdlResponse, TenacioNsdlBody>({
        providerName,
        serviceName,
        method: 'POST',
        baseUrl,
        path: serviceName,
        headers: {
          'client-id': clientId,
          'x-api-key': apiKey,
          'workflow-id': workflowId,
        },
        body: {
          input: {
            panNumber: input.panNumber,
            name: input.fullName.trim().toUpperCase(),
            dob: formatDobDdMmYyyy(input.dobIso),
            consent: true,
          },
        },
        leadId: input.leadId,
      });

      if (!result.ok || !result.body) {
        const httpNote = `HTTP ${result.httpStatus ?? 'N/A'} — vendor unreachable or returned error`;
        this.logger.warn(
          `PAN verification HTTP failure (leadId=${input.leadId.toString()}, HTTP ${result.httpStatus ?? 'N/A'}). Will retry later.`,
        );
        return { ...notChecked, note: httpNote };
      }

      return this.parseVendorResponse(result.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `PAN verification unexpected error (leadId=${input.leadId.toString()}): ${message}`,
      );
      return { ...notChecked, note: `Unexpected error: ${message}`.slice(0, 500) };
    }
  }

  /**
   * Determines the `pan_verified` SmallInt value from a successful Tenacio
   * response. At this point the HTTP call was 2xx; we inspect the payload
   * to distinguish VERIFIED (1) from NOT_VERIFIED (2).
   */
  private parseVendorResponse(body: TenacioNsdlResponse): PanVerificationResult {
    const data = body.data ?? null;
    const vendorRequestId = body.requestId ?? null;

    // Vendor returned `{ success: false, statusCode: 400, … }` inside a 200
    // envelope → API_FAILURE (3). Persisted so we can distinguish "never
    // called" (0) from "called but vendor rejected the request" (3).
    if (body.success === false || body.status !== 'success') {
      const vendorMsg = body.message ?? 'Unknown vendor error';
      this.logger.warn(
        `Tenacio returned non-success envelope: status=${body.status ?? 'undefined'}, message=${vendorMsg}`,
      );
      return {
        panVerifiedStatus: PAN_VERIFIED.API_FAILURE,
        nameMatch: false,
        dobMatch: false,
        panStatus: data?.panStatus ?? null,
        category: data?.category ?? null,
        vendorRequestId,
        note: `API failure: ${vendorMsg}`.slice(0, 500),
      };
    }

    if (!data) {
      return {
        panVerifiedStatus: PAN_VERIFIED.API_FAILURE,
        nameMatch: false,
        dobMatch: false,
        panStatus: null,
        category: null,
        vendorRequestId,
        note: 'API returned success but data was empty',
      };
    }

    const panStatus = data.panStatus ?? null;
    const nameMatch = data.nameMatch === true;
    const dobMatch = data.dobMatch === true;
    const category = data.category ?? null;

    const isVerified =
      panStatus === 'valid' &&
      nameMatch &&
      dobMatch &&
      category === 'Individual';

    const note = isVerified
      ? null
      : `panStatus=${panStatus}, nameMatch=${nameMatch}, dobMatch=${dobMatch}, category=${category}`;

    return {
      panVerifiedStatus: isVerified ? PAN_VERIFIED.VERIFIED : PAN_VERIFIED.NOT_VERIFIED,
      nameMatch,
      dobMatch,
      panStatus,
      category,
      vendorRequestId,
      note,
    };
  }
}
