import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PreBreCheckService } from '../../../../common/bre/pre-bre-check.service';
import { PostBureauOfferService } from '../services/post-bureau-offer.service';
import { BUREAU_FETCHED } from '../../../../common/constants/bureau-fetch.constants';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { PAN_VERIFIED } from '../../../../common/constants/pan-verification.constants';
import { REJECTION_REASON } from '../../../../common/constants/rejection-reason.constants';
import { isPanVerifiedFromDb } from '../../../../common/mappers/customer-portal-profile.mapper';
import { GENDER_SLUG_TO_DB, OCCUPATION_SLUG_TO_DB } from '../../../../common/mappers/lead-detail-master-slugs';
import { parseOptionalInrAmount } from '../../../../common/utils/parse-inr-amount';
import { resolveLeadCityId } from '../../../../common/utils/resolve-lead-city-id.util';
import { SmsService } from '../../../../common/sms/sms.service';
import { parseTenacioBureauVendorBody } from '../../../../common/vendor/tenacio-bureau-payload.mapper';
import { BureauFetchService } from '../../../../common/vendor/bureau-fetch.service';
import { PanVerificationService, type PanVerificationResult } from '../../../../common/vendor/pan-verification.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { BureauReportPdfService } from '../../../../common/cibil/bureau-report-pdf.service';
import { BureauReportRepository } from '../../infrastructure/repositories/bureau-report.repository';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';
import type { VerifyPanDto } from '../dto/verify-pan.dto';

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

const BUREAU_THANK_YOU_MESSAGE =
  'Thank you for your interest. Unfortunately, we are unable to proceed with your application at this time.';

/** Outcome of an attempted Tenacio bureau soft-pull (customer journey). */
type BureauSoftPullOutcome = 'skipped' | 'success' | 'failed' | 'post_bre_failed';

/** `lead_detail` shape after upsert (BRE + response fields). */
const leadDetailUpsertSelect = {
  uuid: true,
  fullName: true,
  dateOfBirth: true,
  pincode: true,
  genderId: true,
  occupationId: true,
  city: { select: { id: true, name: true, stateId: true, state: { select: { code: true } } } },
} as const;

const leadPanSelect = {
  panNumber: true,
  panVerified: true,
  panVerifiedAt: true,
  leadStatusNote: true,
  bureauFetched: true
} as const;

const bureauSoftPullLeadSelect = {
  uuid: true,
  customerId: true,
  bureauFetched: true,
  customer: { select: { uuid: true } },
  leadStatus: { select: { name: true } },
  leadDetail: {
    select: { cibilConsentAt: true, fullName: true },
  },
} as const;

type LeadDetailBreRow = Prisma.LeadDetailGetPayload<{ select: typeof leadDetailUpsertSelect }>;

type LeadPanVerificationRow = {
  panNumber: string | null;
  panVerified: number;
  panVerifiedAt: Date | null;
  leadStatusNote: string | null;
  bureauFetched: number;
};

type BureauSoftPullLeadRow = {
  customer?: { uuid: string };
  uuid: string;
  customerId: bigint;
  bureauFetched: number;
  leadStatus: { name: string } | null;
  leadDetail: {
    cibilConsentAt: Date | null;
    fullName: string | null;
  } | null;
};

/** Same shape as a successful Tenacio response; used when we skip the vendor for an already-verified PAN. */
const VERIFIED_VENDOR_SKIPPED: PanVerificationResult = {
  panVerifiedStatus: PAN_VERIFIED.VERIFIED,
  nameMatch: true,
  dobMatch: true,
  panStatus: 'valid',
  category: 'Individual',
  vendorRequestId: null,
  note: null,
};

function parseDobUtc(dob: string): Date {
  const [y, m, d] = dob.split('-').map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new BadRequestException('Invalid date of birth.');
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type VerifyPanResult =
  | {
      success: true;
      rejected: true;
      message: string;
    }
  | {
      success: true;
      panVerified: boolean;
      panVerifiedStatus: number;
      nameMatch: boolean;
      dobMatch: boolean;
      panStatus: string | null;
      category: string | null;
      leadDetail: {
        uuid: string;
        panNumber: string | null;
        fullName: string | null;
        dateOfBirth: string | null;
        panVerified: boolean;
        panVerifiedAt: string | null;
        /** Mirrors `lead.lead_status_note` (PAN outcome or policy text). */
        leadStatusNote: string | null;
      };
    };

/**
 * Status written to `lead.pan_verified` (SmallInt):
 *   0 = NOT_CHECKED — vendor call failed or was skipped; safe to retry.
 *   1 = VERIFIED    — panStatus=valid, nameMatch, dobMatch, category=Individual.
 *   2 = NOT_VERIFIED — vendor confirmed the PAN doesn't match.
 */
@Injectable()
export class VerifyPanUseCase {
  private readonly logger = new Logger(VerifyPanUseCase.name);

  constructor(
    private readonly preBreCheck: PreBreCheckService,
    private readonly postBureauOffer: PostBureauOfferService,
    private readonly bureauReports: BureauReportRepository,
    private readonly bureauReportPdf: BureauReportPdfService,
    private readonly bureauFetch: BureauFetchService,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly panVerification: PanVerificationService,
    private readonly settings: SettingsRepository,
    private readonly sms: SmsService,
  ) {}

  async execute(req: Request, dto: VerifyPanDto): Promise<VerifyPanResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const leadRow = dto.leadUuid
      ? await this.leads.findByUuidForCustomer(dto.leadUuid, customer.id)
      : await this.leads.findActiveSummaryForCustomer(customer.id);

    if (!leadRow) {
      throw new NotFoundException('No matching active lead was found.');
    }

    const panUpper = dto.panNumber.trim().toUpperCase();

    const priorLeadPan = (await this.leads.findUniqueLead({
      where: { id: leadRow.id },
      select: { panNumber: true, panVerified: true },
    })) as { panNumber: string | null; panVerified: number } | null;

    const leadDetailPayload = await this.buildLeadInputRequest(leadRow.id, dto);
    const fullNameTrimmed = leadDetailPayload.fullName;

    const [[detailRaw, leadPanRaw], [panVerificationEnabled, breSettings]] = await Promise.all([
      Promise.all([
        this.leads.upsertLeadDetail({
          where: { leadId: leadRow.id },
          create: { leadId: leadRow.id, ...leadDetailPayload },
          update: leadDetailPayload,
          select: leadDetailUpsertSelect,
        }),
        this.leads.updateLead({
          where: { id: leadRow.id },
          data: { panNumber: panUpper },
          select: leadPanSelect,
        }),
      ]),
      Promise.all([this.settings.isPanVerificationEnabled(), this.settings.loadBreSettings()]),
    ]);

    const detail = detailRaw as unknown as LeadDetailBreRow;
    const leadPan = leadPanRaw as LeadPanVerificationRow;

    const preBreResult = await this.preBreCheck.run(
      {
        dateOfBirth: detail.dateOfBirth,
        genderId: detail.genderId,
        occupationId: detail.occupationId,
        genderDisplay: GENDER_SLUG_TO_DB[dto.gender] ?? dto.gender,
        occupationDisplay: OCCUPATION_SLUG_TO_DB[dto.occupation] ?? dto.occupation,
        pincode: detail.pincode,
        cityId: detail.city?.id ?? null,
        stateId: detail.city?.stateId ?? null,
        cityName: detail.city?.name ?? null,
        stateCode: detail.city?.state?.code ?? null,
      },
      breSettings,
    );


    if (!preBreResult.passed) {
      await this.rejectLead(leadRow.id, preBreResult.rejectReason ?? 'BRE check failed', preBreResult.rejectionReasonCode);
      this.fireThankYouSms(customer.mobileNumber);
      return {
        success: true,
        rejected: true,
        message: BUREAU_THANK_YOU_MESSAGE,
      };
    }

    if (!panVerificationEnabled) {
      const updatedLeadPan = await this.updatePanStatus(leadRow.id, PAN_VERIFIED.API_DISABLED, 'PAN verification disabled in settings');
      return this.buildResult(detail, updatedLeadPan, {
        panVerifiedStatus: PAN_VERIFIED.API_DISABLED,
        nameMatch: false,
        dobMatch: false,
        panStatus: null,
        category: null,
      });
    }

    const priorPanNorm = (priorLeadPan?.panNumber ?? '').trim().toUpperCase();
    const alreadyVerifiedSamePan =
      priorLeadPan?.panVerified === PAN_VERIFIED.VERIFIED &&
      priorPanNorm.length === 10 &&
      priorPanNorm === panUpper;

    const verification: PanVerificationResult = alreadyVerifiedSamePan
      ? VERIFIED_VENDOR_SKIPPED
      : await this.panVerification.verify({
          leadId: leadRow.id,
          panNumber: panUpper,
          fullName: fullNameTrimmed,
          dobIso: dto.dob,
        });

    if (alreadyVerifiedSamePan) {
      this.logger.debug(
        `PAN vendor call skipped (leadId=${leadRow.id.toString()}): already VERIFIED in DB for this PAN.`,
      );
    } else {
      this.logger.debug(
        `PAN verification result: status=${verification.panVerifiedStatus}, panStatus=${verification.panStatus}, nameMatch=${verification.nameMatch}, dobMatch=${verification.dobMatch}`,
      );
    }

    const leadPanState =
      alreadyVerifiedSamePan
        ? leadPan
        : verification.panVerifiedStatus === PAN_VERIFIED.NOT_CHECKED
          ? leadPan
          : await this.updatePanStatus(leadRow.id, verification.panVerifiedStatus, verification.note);

    const shouldRejectForPan =
      verification.panVerifiedStatus === PAN_VERIFIED.NOT_VERIFIED ||
      verification.panVerifiedStatus === PAN_VERIFIED.API_FAILURE;

    if (shouldRejectForPan) {
      await this.rejectLead(
        leadRow.id,
        this.buildPanRejectLeadNote(dto, verification),
        REJECTION_REASON.PAN_VERIFICATION_FAILED,
      );
      this.fireThankYouSms(customer.mobileNumber);
      return {
        success: true,
        rejected: true,
        message: BUREAU_THANK_YOU_MESSAGE,
      };
    }

    if (verification.panVerifiedStatus === PAN_VERIFIED.VERIFIED) {
      const bureauSnap = (await this.leads.findUniqueLead({
        where: { id: leadRow.id },
        select: { bureauFetched: true },
      })) as { bureauFetched: number } | null;
      const needBureau =
        bureauSnap != null && Number(bureauSnap.bureauFetched) !== BUREAU_FETCHED.SUCCESS;
      if (needBureau) {
        this.logger.debug(
          `Bureau soft-pull starting (leadId=${leadRow.id.toString()}) bureauFetched=${String(bureauSnap.bureauFetched)}`,
        );
        const bureauOutcome = await this.runBureauSoftPull(
          leadRow.id,
          customer.mobileNumber,
          panUpper,
          fullNameTrimmed,
        );
        if (bureauOutcome === 'failed') {
          await this.rejectLead(
            leadRow.id,
            'Bureau soft-pull failed: credit bureau returned a non-200 response.',
            REJECTION_REASON.REJECTED_BY_CLIENTS,
          );
          this.fireThankYouSms(customer.mobileNumber);
          return {
            success: true,
            rejected: true,
            message: BUREAU_THANK_YOU_MESSAGE,
          };
        }
        if (bureauOutcome === 'post_bre_failed') {
          this.fireThankYouSms(customer.mobileNumber);
          return {
            success: true,
            rejected: true,
            message: BUREAU_THANK_YOU_MESSAGE,
          };
        }
      } else if (bureauSnap != null && Number(bureauSnap.bureauFetched) === BUREAU_FETCHED.SUCCESS) {
        const postBreRejected = await this.applyPostBureauOffer({
          leadId: leadRow.id,
          customerId: customer.id,
          leadUuid: leadRow.uuid,
        });
        if (postBreRejected) {
          this.fireThankYouSms(customer.mobileNumber);
          return {
            success: true,
            rejected: true,
            message: BUREAU_THANK_YOU_MESSAGE,
          };
        }
      }
    }

    return this.buildResult(detail, leadPanState, verification);
  }

  private async buildLeadInputRequest(
    leadId: bigint,
    dto: VerifyPanDto,
  ): Promise<{
    fullName: string;
    dateOfBirth: Date;
    genderId: number;
    occupationId: number;
    cityId: number;
    pincode: string;
    addressLine1: string;
    addressLine2: string | null;
    cibilConsentAt: Date | null;
    netMonthlyIncome?: Prisma.Decimal | null;
    annualTurnover?: Prisma.Decimal | null;
    annualProfit?: Prisma.Decimal | null;
  }> {
    const { genderId, occupationId } = await this.resolveGenderOccupationIds(dto);
    const { netMonthlyIncome, annualTurnover, annualProfit } = this.buildIncomeFields(dto);

    const hasAddressInRequest = Boolean(dto.addressLine1?.trim() && dto.pincode?.trim() && dto.currentCity?.trim());

    if (hasAddressInRequest) {
      const cityId = await resolveLeadCityId(this.prisma.client, {
        currentCityId: dto.currentCityId ?? null,
        currentCity: dto.currentCity!.trim(),
      });
      if (cityId == null) {
        throw new BadRequestException(
          'Could not resolve your city. Pick a city from the suggestions list and try again.',
        );
      }

      return {
        fullName: dto.fullName.trim(),
        dateOfBirth: parseDobUtc(dto.dob),
        genderId,
        occupationId,
        cityId,
        pincode: dto.pincode!.trim(),
        addressLine1: dto.addressLine1!.trim(),
        addressLine2: dto.addressLine2?.trim() || null,
        cibilConsentAt: dto.creditConsentAccepted ? new Date() : null,
        netMonthlyIncome,
        annualTurnover,
        annualProfit,
      };
    }

    const existing = await this.prisma.client.leadDetail.findUnique({
      where: { leadId },
      select: {
        cityId: true,
        pincode: true,
        addressLine1: true,
        addressLine2: true,
        cibilConsentAt: true,
      },
    });

    if (!existing?.pincode?.trim() || !existing.cityId || !existing.addressLine1?.trim()) {
      throw new BadRequestException(
        'Save your address details before we run eligibility and PAN verification.',
      );
    }

    return {
      fullName: dto.fullName.trim(),
      dateOfBirth: parseDobUtc(dto.dob),
      genderId,
      occupationId,
      cityId: existing.cityId,
      pincode: existing.pincode.trim(),
      addressLine1: existing.addressLine1.trim(),
      addressLine2: existing.addressLine2?.trim() || null,
      cibilConsentAt: dto.creditConsentAccepted ? new Date() : existing.cibilConsentAt,
      netMonthlyIncome,
      annualTurnover,
      annualProfit,
    };
  }

  private fireThankYouSms(mobileNumber: string): void {
    this.sms.sendThankYouSms(mobileNumber).catch((err) => {
      this.logger.error('Failed to send thank-you SMS', err instanceof Error ? err.stack : err);
    });
  }

  /**
   * Tenacio bureau soft-pull after PAN is verified, when `BUREAU_FETCH_ENABLED`
   * is on, the lead is not terminal-negative, and the customer has bureau
   * consent on `lead_detail`. Outcome is written to `lead.bureau_fetched` /
   * `bureau_fetched_at` / `bureau_fetched_note`. Returns `failed` when the vendor
   * HTTP status is not 200 (caller shows thank-you and rejects the lead).
   */
  private async runBureauSoftPull(
    leadId: bigint,
    customerMobile: string,
    panNumber: string,
    fullName: string,
  ): Promise<BureauSoftPullOutcome> {
    if (!(await this.settings.isBureauFetchEnabled())) {
      this.logger.debug(`Bureau soft-pull skipped (leadId=${leadId}): BUREAU_FETCH_ENABLED is off.`);
      return 'skipped';
    }

    const row = (await this.leads.findUniqueLead({
      where: { id: leadId },
      select: bureauSoftPullLeadSelect,
    })) as BureauSoftPullLeadRow | null;

    if (!row?.leadDetail) {
      this.logger.debug(`Bureau soft-pull skipped (leadId=${leadId}): no lead_detail.`);
      return 'skipped';
    }
    if (row.bureauFetched === BUREAU_FETCHED.SUCCESS) {
      this.logger.debug(`Bureau soft-pull skipped (leadId=${leadId}): bureau already fetched successfully.`);
      return 'skipped';
    }

    const statusName = row.leadStatus?.name;
    if (statusName === LEAD_STATUS.REJECTED || statusName === LEAD_STATUS.BLACKLISTED) {
      this.logger.debug(`Bureau soft-pull skipped (leadId=${leadId}): lead status ${statusName}.`);
      return 'skipped';
    }
    if (!row.leadDetail.cibilConsentAt) {
      this.logger.debug(`Bureau soft-pull skipped (leadId=${leadId}): no bureau consent on file.`);
      return 'skipped';
    }

    const nameForVendor = (row.leadDetail.fullName ?? fullName).trim();
    if (!nameForVendor || panNumber.length !== 10) {
      this.logger.warn(`Bureau soft-pull skipped (leadId=${leadId}): missing name or PAN.`);
      return 'skipped';
    }

    const mobile = customerMobile.trim();
    if (!INDIAN_MOBILE.test(mobile)) {
      this.logger.warn(`Bureau soft-pull skipped (leadId=${leadId}): invalid mobile format.`);
      return 'skipped';
    }

    const out = await this.bureauFetch.fetchBureauFromTenacio(
      { input: { mobileNumber: mobile, name: nameForVendor, panNumber, consent: true } },
      leadId,
    );

    if (!out.configured) {
      this.logger.debug(`Bureau soft-pull not configured (leadId=${leadId}): ${out.skipReason ?? ''}`);
      return 'skipped';
    }

    const now = new Date();
    if (out.httpStatus === 200) {
      await this.leads.updateLead({
        where: { id: leadId },
        data: {
          bureauFetched: BUREAU_FETCHED.SUCCESS,
          bureauFetchedAt: now,
          bureauFetchedNote: null,
        },
      });
      try {
        const parsed = parseTenacioBureauVendorBody(out.vendorBody);
        const created = await this.bureauReports.createFromVendorSnapshot({
          customerId: row.customerId,
          leadId,
          vendorBody: out.vendorBody,
          parsed,
          httpStatus: out.httpStatus,
          dummyFetched: out.dummyPayload,
        });
        const customerUuid = row.customer?.uuid;
        if (customerUuid) {
          await this.bureauReportPdf.generateAndAttachForReport({
            bureauReportId: created.id,
            customerUuid,
            bureauReportUuid: created.uuid,
            vendorBody: out.vendorBody,
          });
        }
      } catch (err) {
        this.logger.warn(
          `BureauReport row not saved (leadId=${leadId.toString()}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      try {
        const offerResult = await this.postBureauOffer.runAfterSuccessfulBureauFetch({
          leadId,
          customerId: row.customerId,
          leadUuid: row.uuid,
        });
        if (!offerResult.ok) {
          return 'post_bre_failed';
        }
      } catch (err) {
        this.logger.error(
          `Post-bureau offer persistence failed (leadId=${leadId.toString()}): ${err instanceof Error ? err.stack : String(err)}`,
        );
      }
      return 'success';
    }

    const note = `http=${out.httpStatus ?? 'n/a'} err=${out.error?.message ?? 'vendor'}`.slice(0, 500);
    await this.leads.updateLead({
      where: { id: leadId },
      data: {
        bureauFetched: BUREAU_FETCHED.FAILED,
        bureauFetchedAt: now,
        bureauFetchedNote: note,
      },
    });
    this.logger.warn(
      `Bureau soft-pull HTTP/vendor issue (leadId=${leadId}): http=${out.httpStatus ?? 'n/a'} transport=${out.error?.message ?? 'none'}`,
    );
    return 'failed';
  }

  private async resolveGenderOccupationIds(
    dto: VerifyPanDto,
  ): Promise<{ genderId: number; occupationId: number }> {
    const genderName = GENDER_SLUG_TO_DB[dto.gender];
    const occupationName = OCCUPATION_SLUG_TO_DB[dto.occupation];
    if (!genderName || !occupationName) {
      throw new BadRequestException('Invalid gender or occupation.');
    }
    const [gender, occupation] = await Promise.all([
      this.prisma.client.gender.findUnique({ where: { name: genderName }, select: { id: true } }),
      this.prisma.client.occupation.findUnique({ where: { name: occupationName }, select: { id: true } }),
    ]);
    if (!gender || !occupation) {
      throw new BadRequestException('Gender or occupation is not available in the system.');
    }
    return { genderId: gender.id, occupationId: occupation.id };
  }

  private buildIncomeFields(dto: VerifyPanDto): {
    netMonthlyIncome?: Prisma.Decimal | null;
    annualTurnover?: Prisma.Decimal | null;
    annualProfit?: Prisma.Decimal | null;
  } {
    const fieldMap = {
      monthlyIncome: 'netMonthlyIncome',
      annualTurnover: 'annualTurnover',
      annualProfit: 'annualProfit',
    } as const;

    type IncomeFieldKey = keyof typeof fieldMap;

    const incomeFields = Object.fromEntries(
      (Object.entries(fieldMap) as Array<[IncomeFieldKey, string]>)
        .filter(([dtoKey]) => dto[dtoKey] !== undefined)
        .map(([dtoKey, dbKey]) => [dbKey, parseOptionalInrAmount(dto[dtoKey])]),
    );

    return incomeFields;
  }

  private buildPanRejectLeadNote(dto: VerifyPanDto, verification: PanVerificationResult): string {
    const occ = OCCUPATION_SLUG_TO_DB[dto.occupation] ?? dto.occupation;
    const gen = GENDER_SLUG_TO_DB[dto.gender] ?? dto.gender;
    const category = verification.category ? ` category=${verification.category}` : '';
    return `PAN not verified: panStatus=${verification.panStatus ?? 'n/a'} nameMatch=${verification.nameMatch} dobMatch=${verification.dobMatch}${category} | occ=${occ} | gender=${gen}`.slice(0, 256);
  }

  /** Returns `true` when post-BRE rejects the lead (e.g. new-to-credit). */
  private async applyPostBureauOffer(params: {
    leadId: bigint;
    customerId: bigint;
    leadUuid: string;
  }): Promise<boolean> {
    try {
      const offerResult = await this.postBureauOffer.runAfterSuccessfulBureauFetch(params);
      return !offerResult.ok;
    } catch (err) {
      this.logger.error(
        `Post-bureau offer persistence failed (leadId=${params.leadId.toString()}): ${err instanceof Error ? err.stack : String(err)}`,
      );
      return false;
    }
  }

  private async rejectLead(leadId: bigint, note: string, rejectionReasonCode?: string | null) {
    const [rejected, reason] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      rejectionReasonCode
        ? (this.prisma.client as any).rejectionReason.findFirst({
            where: { name: rejectionReasonCode, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!rejected) {
      this.logger.warn('LeadStatus REJECTED not found in DB — skipping lead rejection.');
      return;
    }
    await this.leads.updateLead({
      where: { id: leadId },
      data: {
        leadStatusId: rejected.id,
        leadStatusNote: note.slice(0, 256),
        ...(reason ? { rejectionReasonId: reason.id } : {}),
      },
    });
  }

  private updatePanStatus(leadId: bigint, status: number, note?: string | null) {
    const vendorWasContacted =
      status === PAN_VERIFIED.VERIFIED ||
      status === PAN_VERIFIED.NOT_VERIFIED ||
      status === PAN_VERIFIED.API_FAILURE;

    return this.leads.updateLead({
      where: { id: leadId },
      data: {
        panVerified: status,
        panVerifiedAt: vendorWasContacted ? new Date() : null,
        ...(vendorWasContacted
          ? {
              leadStatusNote: note?.trim()
                ? note.trim().slice(0, 256)
                : null,
            }
          : {}),
      },
      select: leadPanSelect,
    }) as Promise<LeadPanVerificationRow>;
  }

  private buildResult(
    detail: LeadDetailBreRow,
    leadPan: LeadPanVerificationRow,
    verification: {
      panVerifiedStatus: number;
      nameMatch: boolean;
      dobMatch: boolean;
      panStatus: string | null;
      category: string | null;
    },
  ): VerifyPanResult {
    return {
      success: true,
      panVerified: isPanVerifiedFromDb(leadPan.panVerified),
      panVerifiedStatus: verification.panVerifiedStatus,
      nameMatch: verification.nameMatch,
      dobMatch: verification.dobMatch,
      panStatus: verification.panStatus,
      category: verification.category,
      leadDetail: {
        uuid: detail.uuid,
        panNumber: leadPan.panNumber,
        fullName: detail.fullName,
        dateOfBirth: detail.dateOfBirth ? toIsoDateOnly(detail.dateOfBirth) : null,
        panVerified: isPanVerifiedFromDb(leadPan.panVerified),
        panVerifiedAt: leadPan.panVerifiedAt?.toISOString() ?? null,
        leadStatusNote: leadPan.leadStatusNote ?? null,
      },
    };
  }
}
