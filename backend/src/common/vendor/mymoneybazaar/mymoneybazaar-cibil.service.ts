import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { VendorApiService } from '../vendor-api.service';
import {
  buildMyMoneyBazaarSoftPullBody,
  isProviderEmail,
  isProviderPincode,
  joinAddressParts,
  type MyMoneyBazaarSoftPullBody,
} from './build-mymoneybazaar-soft-pull-body';
import { mapMyMoneyBazaarSoftPullToTenacioEnvelope } from './mymoneybazaar-cibil-to-tenacio.mapper';

/** mymoneybazaarApi `CibilSoftPullDto` requires `address` `@MinLength(3)`. */
const MIN_ADDRESS_LENGTH = 3;

export type MyMoneyBazaarCibilInput = {
  mobileNumber: string;
  panNumber: string;
  name: string;
  consent: boolean;
};

export type MyMoneyBazaarCibilResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  /**
   * Soft-pull response wrapped into the Tenacio bureau envelope — the keys
   * downstream BRE rules / parsers expect. `null` only when the vendor is
   * skipped (not configured, or the lead is missing DOB / email / pincode /
   * address).
   */
  vendorBody: Record<string, unknown> | null;
  error?: Error;
};

/**
 * Bureau soft-pull via mymoneybazaarApi `POST /api/cibil/soft-pull` (PayMe India
 * merchant path), a selectable `cibil_fetch` vendor ("MyMoneyBazaar").
 *
 * Env: `MMB_CIBIL_URL` + `MMB_CIBIL_ACCESS_TOKEN` (required; sent as the
 * `x-access-token` header). Optional `MMB_CIBIL_PROVIDER`.
 *
 * Name / DOB / gender / email / pincode / address are read from `lead_detail`
 * (email / pincode / address are captured on the address step, which runs before
 * the PAN + bureau step). The provider requires a valid email, 6-digit PIN and a
 * non-empty address, so when any of those is missing the vendor is skipped
 * (`configured: false`) and `BureauFetchService` falls through to the next
 * `cibil_fetch` vendor — no placeholder data is sent to the bureau.
 *
 * Every live call is audited via {@link VendorApiService} → `vendor_api_log`
 * (raw soft-pull body stored there); the returned `vendorBody` is the
 * Tenacio-shaped wrapper so BRE rules and the CIBIL report PDF are unaffected.
 */
@Injectable()
export class MyMoneyBazaarCibilService {
  private readonly logger = new Logger(MyMoneyBazaarCibilService.name);

  constructor(
    private readonly vendorApi: VendorApiService,
    private readonly prisma: PrismaService,
  ) {}

  async fetchCreditReport(
    input: MyMoneyBazaarCibilInput,
    leadId: bigint | null,
  ): Promise<MyMoneyBazaarCibilResult> {
    const url = (process.env.MMB_CIBIL_URL ?? '').trim();
    const token = (process.env.MMB_CIBIL_ACCESS_TOKEN ?? '').trim();
    const providerName = (process.env.MMB_CIBIL_PROVIDER ?? 'MyMoneyBazaar').trim();

    if (!url || !token) {
      return this.skip(
        'MyMoneyBazaar CIBIL is not configured. Set MMB_CIBIL_URL (full /api/cibil/soft-pull URL) and MMB_CIBIL_ACCESS_TOKEN (x-access-token).',
      );
    }

    if (leadId == null) {
      return this.skip(
        'MyMoneyBazaar CIBIL requires a leadId to resolve name / DOB / email / address from lead_detail.',
      );
    }

    const detail = await this.prisma.client.leadDetail.findUnique({
      where: { leadId },
      select: {
        fullName: true,
        dateOfBirth: true,
        emailId: true,
        pincode: true,
        addressLine1: true,
        addressLine2: true,
        gender: { select: { key: true } },
        city: { select: { name: true } },
      },
    });

    const email = detail?.emailId?.trim() ?? '';
    const pincode = detail?.pincode?.trim() ?? '';
    const address = joinAddressParts([detail?.addressLine1, detail?.addressLine2, detail?.city?.name]);

    const missing: string[] = [];
    if (!detail?.dateOfBirth) missing.push('date_of_birth');
    if (!isProviderEmail(email)) missing.push('email_id');
    if (!isProviderPincode(pincode)) missing.push('pincode');
    if (address.length < MIN_ADDRESS_LENGTH) missing.push('address');

    if (missing.length > 0 || !detail?.dateOfBirth) {
      return this.skip(
        `MyMoneyBazaar CIBIL skipped (leadId=${leadId.toString()}): missing/invalid ${missing.join(', ')} on lead_detail.`,
      );
    }

    const body = buildMyMoneyBazaarSoftPullBody({
      fullName: (detail.fullName ?? input.name).trim(),
      dateOfBirth: detail.dateOfBirth,
      genderKey: detail.gender?.key ?? null,
      mobileNumber: input.mobileNumber,
      panNumber: input.panNumber,
      email,
      pincode,
      address,
    });

    this.logger.log(
      `MyMoneyBazaar CIBIL soft-pull (leadId=${leadId.toString()}) ` +
        `email=${maskEmail(body.email)} pin=${body.pin_code}`,
    );

    const result = await this.vendorApi.request<unknown, MyMoneyBazaarSoftPullBody>({
      providerName,
      serviceName: 'cibil-soft-pull',
      method: 'POST',
      absoluteUrl: url,
      headers: { 'x-access-token': token },
      body,
      leadId,
      sensitiveHeaderNames: ['x-access-token'],
      redactRequest: (b) => redactSoftPullBody(b),
    });

    const vendorBody = mapMyMoneyBazaarSoftPullToTenacioEnvelope(result.body, result.httpStatus, {
      fullName: detail.fullName ?? input.name,
    }) as unknown as Record<string, unknown>;

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
      vendorBody,
      error: result.error,
    };
  }

  private skip(skipReason: string): MyMoneyBazaarCibilResult {
    this.logger.warn(skipReason);
    return { configured: false, skipReason, ok: false, httpStatus: null, vendorBody: null };
  }
}

/** `saurabh@example.com` → `sa***@example.com` (audit-log safe). */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || !local) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Mask PAN / phone / email before the request body lands in `vendor_api_log`. */
function redactSoftPullBody(body: MyMoneyBazaarSoftPullBody | undefined): unknown {
  if (!body) return body;
  const pan = body.pan_card_number;
  const phone = body.phone_number;
  return {
    ...body,
    pan_card_number: pan.length > 4 ? `${pan.slice(0, 3)}…${pan.slice(-1)}` : '[pan]',
    phone_number: phone.length > 4 ? `${phone.slice(0, 2)}••••${phone.slice(-2)}` : '[phone]',
    email: maskEmail(body.email),
  };
}
