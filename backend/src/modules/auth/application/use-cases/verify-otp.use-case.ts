import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
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

export type VerifyOtpSessionMeta = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class VerifyOtpUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpTypes: OtpTypeRepository,
    private readonly otpRequests: OtpRequestRepository,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
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
      await this.otpRequests.incrementAttempts(undefined, request.id);
      throw new BadRequestException('Incorrect OTP. Please try again.');
    }

    const verifiedAt = new Date();

    const { customer, lead } = await this.prisma.client.$transaction(async (tx) => {
      await this.otpRequests.markVerified(tx, request.id, verifiedAt);
      const cust = await this.customers.upsertByMobile(tx, request.value);
      const newStatus = await this.leadStatuses.findActiveByName(tx, LEAD_STATUS.NEW);
      if (!newStatus) {
        throw new InternalServerErrorException('Lead status NEW is missing. Run database seeds.');
      }
      const leadExpireAt = new Date();
      leadExpireAt.setUTCDate(leadExpireAt.getUTCDate() + settings.leadExpireDays);

      let activeLead = await this.leads.findActiveByCustomerId(tx, cust.id);
      if (!activeLead) {
        activeLead = await this.leads.createForCustomer(tx, {
          customerId: cust.id,
          leadStatusId: newStatus.id,
          expiresAt: leadExpireAt,
        });
      }
      return { customer: cust, lead: activeLead };
    });

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
      await this.otpRequests.incrementAttempts(undefined, request.id);
      throw new BadRequestException('Incorrect OTP. Please try again.');
    }

    const verifiedAt = new Date();

    await this.prisma.client.$transaction(async (tx) => {
      await this.otpRequests.markVerified(tx, request.id, verifiedAt);
      const lead = await this.leads.findActiveByCustomerId(tx, customer.id);
      if (!lead) {
        throw new BadRequestException('No active lead for this account. Complete mobile verification first.');
      }
      await this.leads.updateEmailFromOtp(tx, lead.id, request.value);
      await this.leads.applyInProgressAfterEmailVerified(tx, lead);
    });

    return {
      success: true,
      requestId: request.uuid,
      verified: true,
      verifiedAt: verifiedAt.toISOString(),
    };
  }

  private assertOtpWindow(
    request: { expiresAt: Date; attemptCount: number },
    settings: { otpMaxAttempts: number }
  ) {
    if (request.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This OTP has expired. Request a new code.');
    }
    if (request.attemptCount >= settings.otpMaxAttempts) {
      throw new BadRequestException('Too many incorrect attempts. Request a new OTP.');
    }
  }
}
