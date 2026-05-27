import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { OTP_TYPE } from '../../../../common/constants/otp.constants';
import { isLeadEmailVerifiedForPortal } from '../../../../common/mappers/customer-portal-profile.mapper';
import { safeEqualOtp } from '../../infrastructure/crypto/otp-compare.util';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { OtpRequestRepository } from '../../infrastructure/repositories/otp-request.repository';
import { OtpTypeRepository } from '../../infrastructure/repositories/otp-type.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AcceptLoanDocumentsDto } from '../dto/accept-loan-documents.dto';
import { LoanDocumentApplicationService } from '../services/loan-document-application.service';

function readClientIp(req: Request): string | undefined {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0]?.trim();
  }
  return req.ip;
}

@Injectable()
export class AcceptLoanDocumentsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly loanDocs: LoanDocumentApplicationService,
    private readonly otpTypes: OtpTypeRepository,
    private readonly otpRequests: OtpRequestRepository,
    private readonly settingsRepository: SettingsRepository,
  ) {}

  async execute(req: Request, dto: AcceptLoanDocumentsDto) {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) throw new UnauthorizedException('Customer not found.');

    const lead = await this.leads.findActiveByCustomerId(customer.id);
    if (!lead) throw new BadRequestException('No active lead found.');

    const ctx = await this.loanDocs.loadApplicationContext(customer.uuid, lead.id);
    const app = ctx.application;

    if (app.loanDocumentsAcceptedAt) {
      return { success: true, acceptedAt: app.loanDocumentsAcceptedAt.toISOString() };
    }

    const emailVerified = isLeadEmailVerifiedForPortal(
      lead.leadStatus.name,
      app.email,
      app.emailVerificationType,
    );
    if (!emailVerified) {
      throw new BadRequestException('Verify your email before accepting loan documents.');
    }

    const settings = await this.settingsRepository.loadAuthOtpSettings();
    const otpType = await this.otpTypes.findActiveByName(undefined, OTP_TYPE.MOBILE);
    if (!otpType) {
      throw new InternalServerErrorException('OTP is not configured. Run database seeds.');
    }

    const request = await this.otpRequests.findPendingByUuidAndType(undefined, dto.requestId, otpType.id);
    if (!request) {
      throw new BadRequestException('Invalid or expired OTP request.');
    }
    if (request.value !== customer.mobileNumber) {
      throw new BadRequestException('OTP does not match this session.');
    }

    if (request.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This OTP has expired. Request a new code.');
    }
    if (request.attemptCount >= settings.otpMaxAttempts) {
      throw new BadRequestException('Too many incorrect attempts. Request a new OTP.');
    }

    const given = dto.otpCode.trim().padStart(settings.otpLength, '0');
    if (!safeEqualOtp(request.otpCode, given)) {
      await this.otpRequests.incrementAttempts(undefined, request.id);
      throw new BadRequestException('Incorrect OTP. Please try again.');
    }

    const verifiedAt = new Date();
    const ip = readClientIp(req);

    const acceptedAt = await this.prisma.client.$transaction(async (tx) => {
      await this.otpRequests.markVerified(tx, request.id, verifiedAt);

      const updated = await tx.application.update({
        where: { id: app.id },
        data: { loanDocumentsAcceptedAt: verifiedAt },
        select: { loanDocumentsAcceptedAt: true },
      });

      await tx.applicationAgreement.upsert({
        where: { applicationId: app.id },
        create: {
          applicationId: app.id,
          documentName: 'Key Fact Statement + Loan Agreement',
          ipAddress: ip ?? null,
          signedAt: verifiedAt,
        },
        update: {
          documentName: 'Key Fact Statement + Loan Agreement',
          ipAddress: ip ?? null,
          signedAt: verifiedAt,
        },
      });

      return updated.loanDocumentsAcceptedAt!;
    });

    return { success: true, acceptedAt: acceptedAt.toISOString() };
  }
}
