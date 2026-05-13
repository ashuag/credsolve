import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { BreCheckService } from '../../../../common/bre/bre-check.service';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { PAN_VERIFIED } from '../../../../common/constants/pan-verification.constants';
import { REJECTION_REASON } from '../../../../common/constants/rejection-reason.constants';
import { isPanVerifiedFromDb } from '../../../../common/mappers/customer-portal-profile.mapper';
import { SmsService } from '../../../../common/sms/sms.service';
import { PanVerificationService } from '../../../../common/vendor/pan-verification.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';
import type { VerifyPanDto } from '../dto/verify-pan.dto';

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

const leadDetailSelect = {
  uuid: true,
  panNumber: true,
  fullName: true,
  dateOfBirth: true,
  panVerified: true,
  panVerifiedAt: true,
  panVerificationNote: true,
} as const;

export type VerifyPanResult = {
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
    panVerificationNote: string | null;
  };
};

/**
 * Persists PAN + name + DOB on `lead_detail` and verifies the PAN against
 * NSDL via Tenacio (delegated to `PanVerificationService`).
 *
 * Status written to `lead_detail.pan_verified` (SmallInt):
 *   0 = NOT_CHECKED — vendor call failed or was skipped; safe to retry.
 *   1 = VERIFIED    — panStatus=valid, nameMatch, dobMatch, category=Individual.
 *   2 = NOT_VERIFIED — vendor confirmed the PAN doesn't match.
 */
@Injectable()
export class VerifyPanUseCase {
  private readonly logger = new Logger(VerifyPanUseCase.name);

  constructor(
    private readonly breCheck: BreCheckService,
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
    const fullNameTrimmed = dto.fullName.trim();
    const dateOfBirth = parseDobUtc(dto.dob);

    const [detail, panVerificationEnabled, breSettings] = await Promise.all([
      this.prisma.client.leadDetail.upsert({
        where: { leadId: leadRow.id },
        create: {
          leadId: leadRow.id,
          panNumber: panUpper,
          fullName: fullNameTrimmed,
          dateOfBirth,
        },
        update: {
          panNumber: panUpper,
          fullName: fullNameTrimmed,
          dateOfBirth,
        },
        select: leadDetailSelect,
      }),
      this.settings.isPanVerificationEnabled(),
      this.settings.loadBreSettings(),
    ]);

    // BRE: fetch location data for the lead and run eligibility checks.
    const leadDetail = await this.prisma.client.leadDetail.findUnique({
      where: { leadId: leadRow.id },
      select: {
        pincode: true,
        city: { select: { name: true, state: { select: { code: true } } } },
      },
    });

    const breResult = this.breCheck.run(
      {
        dateOfBirth,
        pincode: leadDetail?.pincode ?? null,
        cityName: leadDetail?.city?.name ?? null,
        stateCode: leadDetail?.city?.state?.code ?? null,
      },
      breSettings,
    );

    if (!breResult.passed) {
      await this.rejectLead(leadRow.id, breResult.rejectReason ?? 'BRE check failed', breResult.rejectionReasonCode);
      this.sms.sendThankYouSms(customer.mobileNumber).catch((err) => {
        this.logger.error('Failed to send thank-you SMS', err instanceof Error ? err.stack : err);
      });
      return {
        success: true,
        rejected: true,
        message: 'Thank you for your interest. Unfortunately, we are unable to proceed with your application at this time.',
      } as any;
    }

    if (!panVerificationEnabled) {
      const note = 'PAN verification disabled in settings';
      const updated = await this.updatePanStatus(leadRow.id, PAN_VERIFIED.API_DISABLED, note);
      return this.buildResult(updated, {
        panVerifiedStatus: PAN_VERIFIED.API_DISABLED,
        nameMatch: false,
        dobMatch: false,
        panStatus: null,
        category: null,
      });
    }

    // Skip the vendor call if this exact PAN is already verified.
    // Type bridge: generated client may type panVerified as boolean until regenerated.
    const alreadyVerified =
      isPanVerifiedFromDb(detail.panVerified) &&
      detail.panNumber === panUpper;

    if (alreadyVerified) {
      this.logger.debug('PAN already verified for this lead — skipping vendor call.');
      return this.buildResult(detail, {
        panVerifiedStatus: PAN_VERIFIED.VERIFIED,
        nameMatch: true,
        dobMatch: true,
        panStatus: 'valid',
        category: 'Individual',
      });
    }

    const verification = await this.panVerification.verify({
      leadId: leadRow.id,
      panNumber: panUpper,
      fullName: fullNameTrimmed,
      dobIso: dto.dob,
    });

    this.logger.debug(
      `PAN verification result: status=${verification.panVerifiedStatus}, panStatus=${verification.panStatus}, nameMatch=${verification.nameMatch}, dobMatch=${verification.dobMatch}`,
    );

    // Persist any status except NOT_CHECKED (0). The default 0 means "never
    // attempted" — we only overwrite it once we have an actual outcome.
    let updatedDetail = detail;
    if (verification.panVerifiedStatus !== PAN_VERIFIED.NOT_CHECKED) {
      updatedDetail = await this.updatePanStatus(leadRow.id, verification.panVerifiedStatus, verification.note);
    }

    if (verification.panVerifiedStatus === PAN_VERIFIED.NOT_VERIFIED) {
      await this.rejectLead(leadRow.id, 'PAN validation failed', REJECTION_REASON.PAN_VERIFICATION_FAILED);
      this.sms.sendThankYouSms(customer.mobileNumber).catch((err) => {
        this.logger.error('Failed to send thank-you SMS', err instanceof Error ? err.stack : err);
      });
    }

    return this.buildResult(updatedDetail, verification);
  }

  private async rejectLead(leadId: bigint, note: string, rejectionReasonCode?: string | null) {
    const [rejected, reason] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      rejectionReasonCode
        ? this.prisma.client.rejectionReason.findFirst({
            where: { name: rejectionReasonCode, isActive: true },
            select: { id: true },
          })
        : null,
    ]);
    if (!rejected) {
      this.logger.warn('LeadStatus REJECTED not found in DB — skipping lead rejection.');
      return;
    }
    await this.prisma.client.lead.update({
      where: { id: leadId },
      data: {
        leadStatusId: rejected.id,
        leadStatusNote: note,
        ...(reason ? { rejectionReasonId: reason.id } : {}),
      } as unknown as Prisma.LeadUpdateInput,
    });
  }

  /** Write pan_verified + pan_verified_at + pan_verification_note. */
  private updatePanStatus(leadId: bigint, status: number, note?: string | null) {
    // Set panVerifiedAt for statuses where the vendor was actually contacted (1/2/3).
    // Status 4 (API_DISABLED) never hits the vendor → no timestamp.
    const vendorWasContacted =
      status === PAN_VERIFIED.VERIFIED ||
      status === PAN_VERIFIED.NOT_VERIFIED ||
      status === PAN_VERIFIED.API_FAILURE;

    return this.prisma.client.leadDetail.update({
      where: { leadId },
      data: {
        panVerified: status,
        panVerifiedAt: vendorWasContacted ? new Date() : null,
        panVerificationNote: note?.slice(0, 500) ?? null,
      } as unknown as Prisma.LeadDetailUpdateInput,
      select: leadDetailSelect,
    });
  }

  private buildResult(
    detail: { uuid: string; panNumber: string | null; fullName: string | null; dateOfBirth: Date | null; panVerified: number | boolean | null; panVerifiedAt: Date | null; panVerificationNote?: string | null },
    verification: { panVerifiedStatus: number; nameMatch: boolean; dobMatch: boolean; panStatus: string | null; category: string | null },
  ): VerifyPanResult {
    return {
      success: true,
      panVerified: isPanVerifiedFromDb(detail.panVerified),
      panVerifiedStatus: verification.panVerifiedStatus,
      nameMatch: verification.nameMatch,
      dobMatch: verification.dobMatch,
      panStatus: verification.panStatus,
      category: verification.category,
      leadDetail: {
        uuid: detail.uuid,
        panNumber: detail.panNumber,
        fullName: detail.fullName,
        dateOfBirth: detail.dateOfBirth ? toIsoDateOnly(detail.dateOfBirth) : null,
        panVerified: isPanVerifiedFromDb(detail.panVerified),
        panVerifiedAt: detail.panVerifiedAt?.toISOString() ?? null,
        panVerificationNote: detail.panVerificationNote ?? null,
      },
    };
  }
}
