import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { VerifyOtpDto } from '../dto/verify-otp.dto';
import type { VerifyOtpResult } from '../contracts/verify-otp-result.contract';
import type { CustomerSessionPayload } from '../contracts/customer-session-payload.contract';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { OTP_TYPE } from '../../../../common/constants/otp.constants';
import { CustomerSessionService } from '../../infrastructure/session/customer-session.service';
import { safeEqualOtp } from '../../infrastructure/crypto/otp-compare.util';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { LeadStatusRepository } from '../../infrastructure/repositories/lead-status.repository';
import { OtpRequestRepository } from '../../infrastructure/repositories/otp-request.repository';
import { OtpTypeRepository } from '../../infrastructure/repositories/otp-type.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import { EmailVerificationType } from '@prisma/client';

export type VerifyOtpSessionMeta = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class VerifyOtpUseCase {
  private readonly logger = new Logger(VerifyOtpUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpTypes: OtpTypeRepository,
    private readonly otpRequests: OtpRequestRepository,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly leadStatuses: LeadStatusRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly customerSessions: CustomerSessionService
  ) {}

  async execute(
    dto: VerifyOtpDto,
    customerSession?: CustomerSessionPayload,
    meta?: VerifyOtpSessionMeta
  ): Promise<VerifyOtpResult> {
    if (dto.type === OTP_TYPE.MOBILE) {
      return this.verifyMobile(dto, meta);
    }
    return this.verifyEmail(dto, customerSession);
  }

  private async verifyMobile(dto: VerifyOtpDto, meta?: VerifyOtpSessionMeta): Promise<VerifyOtpResult> {
    const settings = await this.settingsRepository.loadAuthOtpSettings();
    const otpType = await this.otpTypes.findActiveByName(undefined, OTP_TYPE.MOBILE);
    if (!otpType) {
      throw new InternalServerErrorException('OTP is not configured. Run database seeds.');
    }

    const request = await this.otpRequests.findPendingByUuidAndType(undefined, dto.requestId, otpType.id);
    if (!request) {
      throw new BadRequestException('Invalid or expired OTP request.');
    }
    this.assertOtpWindow(request, settings);

    const given = dto.otpCode.trim().padStart(settings.otpLength, '0');
    if (!safeEqualOtp(request.otpCode, given)) {
      await this.registerFailedAttempt(request, settings);
    }

    const verifiedAt = new Date();

    const leadPolicy = await this.settingsRepository.loadCustomerLeadPolicySettings();
    const reapplyDays = leadPolicy.reapplyAfterRejectedDays;
    const blacklistThreshold = leadPolicy.blacklistRejectionThreshold;
    const blacklistDurationDays = leadPolicy.blacklistDurationDays;

    const { customer, lead } = await this.prisma.client.$transaction(async (tx) => {
      await this.otpRequests.markVerified(tx, request.id, verifiedAt);
      const cust = await this.customers.upsertByMobile(tx, request.value);
      
      const newStatus = await this.leadStatuses.findActiveByName(tx, LEAD_STATUS.NEW);
      if (!newStatus) {
        throw new InternalServerErrorException('Lead status NEW is missing. Run database seeds.');
      }
      const leadExpireAt = new Date();
      this.logger.log('leadExpireAt', leadExpireAt);
      leadExpireAt.setUTCDate(leadExpireAt.getUTCDate() + settings.leadExpireDays);

      let recentLead = await this.leads.findActiveByCustomerId(cust.id, tx);

      if (!recentLead) {
        recentLead = await this.leads.createForCustomer(
          {
            customerId: cust.id,
            leadStatusId: newStatus.id,
            expiresAt: leadExpireAt,
          },
          tx
        );
      }

      const autoRejectResult = await this.checkAutoRejectOrBlacklist(
        cust.id, recentLead, tx,
        { reapplyDays, blacklistThreshold, blacklistDurationDays },
      );
      if (autoRejectResult) {
        recentLead = autoRejectResult;
      }

      if (!recentLead) {
        throw new InternalServerErrorException('Failed to resolve lead for customer.');
      }

      const utmSource = request.utmSource?.trim() || null;
      const utmMedium = request.utmMedium?.trim() || null;
      const utmCampaign = request.utmCampaign?.trim() || null;
      const utmTerm = request.utmTerm?.trim() || null;
      const utmContent = request.utmContent?.trim() || null;
      if (utmSource || utmMedium || utmCampaign || utmTerm || utmContent) {
        await tx.leadUtm.create({
          data: {
            leadId: recentLead.id,
            utmSource,
            utmMedium,
            utmCampaign,
            utmTerm,
            utmContent,
          },
        });
      }

      return { customer: cust, lead: recentLead };
    });

    if (!lead) {
      throw new InternalServerErrorException('Failed to resolve lead for customer.');
    }

    const created = await this.customerSessions.createSession({
      customerUuid: customer.uuid,
      mobileNumber: customer.mobileNumber,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      requestId: request.uuid,
      verified: true,
      verifiedAt: verifiedAt.toISOString(),
      customerId: customer.uuid,
      mobileNumber: customer.mobileNumber,
      leadId: lead.uuid,
      leadStatus: lead.leadStatus.name,
      sessionCookie: {
        name: created.cookieName,
        sessionId: created.sessionId,
        maxAgeMs: created.maxAgeMs,
      },
    };
  }

  private async verifyEmail(dto: VerifyOtpDto, customerSession?: CustomerSessionPayload): Promise<VerifyOtpResult> {
    if (!customerSession) {
      throw new UnauthorizedException('Session required to verify email OTP.');
    }

    const settings = await this.settingsRepository.loadAuthOtpSettings();
    const otpType = await this.otpTypes.findActiveByName(undefined, OTP_TYPE.EMAIL);
    if (!otpType) {
      throw new InternalServerErrorException('Email OTP is not configured. Run database seeds.');
    }

    const customer = await this.customers.findByUuid(undefined, customerSession.sub);
    if (!customer) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    const request = await this.otpRequests.findPendingByUuidAndType(undefined, dto.requestId, otpType.id);
    if (!request) {
      throw new BadRequestException('Invalid or expired OTP request.');
    }
    this.assertOtpWindow(request, settings);

    const given = dto.otpCode.trim().padStart(settings.otpLength, '0');
    if (!safeEqualOtp(request.otpCode, given)) {
      await this.registerFailedAttempt(request, settings);
    }

    const verifiedAt = new Date();

    await this.prisma.client.$transaction(async (tx) => {
      await this.otpRequests.markVerified(tx, request.id, verifiedAt);
      const lead = await this.leads.findActiveByCustomerId(customer.id, tx);
      if (!lead) {
        throw new BadRequestException('No active lead for this account. Complete mobile verification first.');
      }
      await this.applications.updateEmailWithVerification(
        {
          leadId: lead.id,
          customerId: customer.id,
          email: request.value,
          verificationType: EmailVerificationType.OTP,
        },
        tx,
      );
      await this.leads.applyInProgressAfterEmailVerified(lead, tx);
    });

    return {
      success: true,
      requestId: request.uuid,
      verified: true,
      verifiedAt: verifiedAt.toISOString(),
    };
  }

  /** Old REJECTED / BLACKLISTED / CONVERTED leads should be deactivated to make room for a new one. */
  private shouldDeactivate(lead: { leadStatus: { name: string } }): boolean {
    const s = lead.leadStatus.name;
    return s === LEAD_STATUS.REJECTED || s === LEAD_STATUS.BLACKLISTED || s === LEAD_STATUS.CONVERTED;
  }

  /**
   * After creating a fresh NEW lead, inspect the customer's rejection history:
   *  If the last consecutive rejected leads >= threshold → blacklist.
   *  Returns the updated lead row if it was blacklisted, or null if clean.
   */
  private async checkAutoRejectOrBlacklist(
    customerId: bigint,
    lead: { id: bigint; leadStatus: { name: string } },
    tx: Parameters<Parameters<PrismaService['client']['$transaction']>[0]>[0],
    cfg: { reapplyDays: number; blacklistThreshold: number; blacklistDurationDays: number },
  ) {
    if (lead.leadStatus.name !== LEAD_STATUS.NEW) return null;

    const shouldBlacklist = await this.leads.shouldBlackListCustomer(
      customerId, cfg.blacklistThreshold, tx as any,
    );
    if (!shouldBlacklist) return null;

    this.logger.warn(
      `Customer ${customerId}: ${cfg.blacklistThreshold} consecutive rejections — blacklisting.`,
    );
    return this.autoRejectLead(
      lead.id,
      LEAD_STATUS.BLACKLISTED,
      `Blacklisted: ${cfg.blacklistThreshold} consecutive rejections`,
      tx as any,
    );
  }

  private async autoRejectLead(
    leadId: bigint,
    statusName: string,
    note: string,
    tx: any,
  ) {
    const statusRow = await this.leadStatuses.findActiveByName(tx, statusName);
    if (!statusRow) {
      this.logger.error(`LeadStatus ${statusName} not found — skipping auto-reject.`);
      return null;
    }
    return tx.lead.update({
      where: { id: leadId },
      data: {
        leadStatusId: statusRow.id,
        leadStatusNote: note,
      } as unknown as Prisma.LeadUpdateInput,
      include: {
        leadStatus: { select: { name: true } },
        leadDetail: {
          include: {
            gender: { select: { name: true } },
            occupation: { select: { name: true } },
            city: { select: { name: true, state: { select: { code: true } } } },
          },
        },
      },
    });
  }

  private assertOtpWindow(
    request: { expiresAt: Date; attemptCount: number },
    settings: { otpMaxAttempts: number; otpResendCooldownSeconds: number }
  ) {
    if (request.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This OTP has expired. Request a new code.');
    }
    if (request.attemptCount >= settings.otpMaxAttempts) {
      throw new BadRequestException(
        `Too many incorrect attempts. Please wait ${settings.otpResendCooldownSeconds} seconds before requesting a new OTP.`
      );
    }
  }

  /**
   * Record a wrong-OTP attempt. Once `otpMaxAttempts` is reached without a successful
   * verification, further verification is blocked; the matching `send-otp` cooldown then
   * prevents a fresh OTP from being requested for `otpResendCooldownSeconds`.
   */
  private async registerFailedAttempt(
    request: { id: number; attemptCount: number },
    settings: { otpMaxAttempts: number; otpResendCooldownSeconds: number }
  ): Promise<never> {
    const updated = await this.otpRequests.incrementAttempts(undefined, request.id);

    if (updated.attemptCount >= settings.otpMaxAttempts) {
      throw new BadRequestException(
        `Too many incorrect attempts. Please wait ${settings.otpResendCooldownSeconds} seconds before requesting a new OTP.`
      );
    }

    const remainingAttempts = settings.otpMaxAttempts - updated.attemptCount;
    throw new BadRequestException(
      `Incorrect OTP. You have ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} left.`
    );
  }
}
