import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { OTP_TYPE } from '../../../../common/constants/otp.constants';
import {
  LOAN_COMMERCIAL_TERMS_PDF_FILENAME,
  LOAN_DOCUMENT_PDF_FILES,
  LOAN_DOCUMENT_TYPE,
} from '../../../../common/constants/loan-document.constants';
import { APPLICATION_STATUS } from '../../../../common/constants/application.constants';
import { EmailService } from '../../../../common/email/email.service';
import { SmsService } from '../../../../common/sms/sms.service';
import { readClientIp } from '../../../../common/http/client-ip.util';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { isLeadEmailVerifiedForPortal } from '../../../../common/mappers/customer-portal-profile.mapper';
import { maskEmail } from '../../infrastructure/utils/email.util';
import { safeEqualOtp } from '../../infrastructure/crypto/otp-compare.util';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { OtpRequestRepository } from '../../infrastructure/repositories/otp-request.repository';
import { OtpTypeRepository } from '../../infrastructure/repositories/otp-type.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AcceptLoanDocumentsDto } from '../dto/accept-loan-documents.dto';
import { LoanDocumentApplicationService } from '../services/loan-document-application.service';

/**
 * After references: verify mobile OTP, record acceptance, email signed sanctioned letter.
 */
@Injectable()
export class AcceptLoanDocumentsUseCase {
  private readonly logger = new Logger(AcceptLoanDocumentsUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly loanDocs: LoanDocumentApplicationService,
    private readonly kycFiles: KycFilesService,
    private readonly emailService: EmailService,
    private readonly otpTypes: OtpTypeRepository,
    private readonly otpRequests: OtpRequestRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly sms: SmsService,
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

    if (!app.loanDocumentsReviewedAt) {
      throw new BadRequestException('Review the sanction letter before accepting with OTP.');
    }

    const refsCount = await this.prisma.client.applicationReference.count({
      where: {
        applicationId: app.id,
        fullName: { not: '' },
        mobileNumber: { not: '' },
      },
    });
    if (refsCount < 2) {
      throw new BadRequestException('Add two personal references before accepting with OTP.');
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

      const updated = await tx.applicationDetail.update({
        where: { applicationId: app.id },
        data: {
          loanDocumentsAcceptedAt: verifiedAt,
          loanDocumentsAcceptedIp: ip ?? null,
        },
        select: { loanDocumentsAcceptedAt: true },
      });

      return updated.loanDocumentsAcceptedAt!;
    });

    const merge = this.loanDocs.buildMergeInput({
      customer: ctx.customer,
      lead: ctx.lead,
      application: ctx.application,
      acceptanceIpAddress: ip ?? null,
      acceptanceSignedAt: verifiedAt,
    });
    const docType = LOAN_DOCUMENT_TYPE.KEY_FACT;
    await this.loanDocs.ensurePdf(
      docType,
      customer.uuid,
      ctx.application.uuid,
      ctx.application.id,
      merge,
      this.loanDocs.relativePathForType(docType, ctx.application),
      true,
      true,
    );

    await this.sendSanctionedLetterEmail(ctx, lead.id);
    await this.notifyIfBankVerificationFailed(app.id, customer.mobileNumber, lead.id);

    return { success: true, acceptedAt: acceptedAt.toISOString() };
  }

  /** After eSign, penny-drop failures get the “representative will call” SMS — not a rejection. */
  private async notifyIfBankVerificationFailed(
    applicationId: bigint,
    mobile: string,
    leadId: bigint,
  ): Promise<void> {
    const row = await this.prisma.client.application.findUnique({
      where: { id: applicationId },
      select: { applicationStatus: { select: { name: true } } },
    });
    if (row?.applicationStatus.name !== APPLICATION_STATUS.PENNYDROP_FAILED) return;
    void this.sms.sendUnderReviewSms(mobile, leadId).catch((err) => {
      this.logger.error(
        'Failed to send representative-callback SMS after penny-drop failure',
        err instanceof Error ? err.stack : err,
      );
    });
  }

  private async sendSanctionedLetterEmail(
    ctx: Awaited<ReturnType<LoanDocumentApplicationService['loadApplicationContext']>>,
    leadId: bigint,
  ): Promise<void> {
    const email = ctx.application.email?.trim();
    if (!email) {
      this.logger.warn(
        `Sanctioned letter ready for application ${ctx.application.uuid} but no email is stored.`,
      );
      return;
    }

    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        `[loan-docs] SMTP not configured; skipping sanctioned letter email to ${maskEmail(email)}.`,
      );
      return;
    }

    try {
      const docType = LOAN_DOCUMENT_TYPE.KEY_FACT;
      const rel = this.loanDocs.relativePathForType(docType, ctx.application)?.trim() || null;
      if (!rel || !(await this.kycFiles.exists(rel))) {
        this.logger.warn(
          `[loan-docs] Signed PDF not found for application ${ctx.application.uuid}; omitting from email.`,
        );
        return;
      }

      const content = await this.kycFiles.readBytes(rel);

      const merge = this.loanDocs.buildMergeInput({
        customer: ctx.customer,
        lead: ctx.lead,
        application: ctx.application,
      });
      const commercialTerms = await this.loanDocs.generateCommercialTermsPdf(merge);

      await this.emailService.sendSanctionedLetterEmail(
        email,
        [
          { filename: LOAN_DOCUMENT_PDF_FILES[docType], content },
          { filename: LOAN_COMMERCIAL_TERMS_PDF_FILENAME, content: commercialTerms },
        ],
        { leadId },
      );
      this.logger.log(
        `Sanctioned letter emailed to ${maskEmail(email)} for application ${ctx.application.uuid}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to email sanctioned letter to ${maskEmail(email)} for application ${ctx.application.uuid}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
