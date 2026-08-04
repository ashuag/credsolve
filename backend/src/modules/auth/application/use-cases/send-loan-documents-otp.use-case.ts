import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SMS_TEMPLATE_ID } from '../../../../common/constants/sms.constants';
import { OTP_TYPE } from '../../../../common/constants/otp.constants';
import { readClientIp } from '../../../../common/http/client-ip.util';
import { isLeadEmailVerifiedForPortal } from '../../../../common/mappers/customer-portal-profile.mapper';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SendOtpDto } from '../dto/send-otp.dto';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { SendOtpUseCase } from './send-otp.use-case';
import { LoanDocumentApplicationService } from '../services/loan-document-application.service';

/** Sends eSign OTP after references are saved (not on /loan-documents). */
@Injectable()
export class SendLoanDocumentsOtpUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly loanDocs: LoanDocumentApplicationService,
    private readonly sendOtp: SendOtpUseCase,
    private readonly prisma: PrismaService,
  ) {}

  async execute(req: Request) {
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
      throw new BadRequestException('Loan documents are already accepted.');
    }

    if (!app.loanDocumentsReviewedAt) {
      throw new BadRequestException('Review and agree to loan documents before requesting OTP.');
    }

    const refsCount = await this.prisma.client.applicationReference.count({
      where: {
        applicationId: app.id,
        fullName: { not: '' },
        mobileNumber: { not: '' },
      },
    });
    if (refsCount < 2) {
      throw new BadRequestException('Add two personal references before requesting OTP.');
    }

    const emailVerified = isLeadEmailVerifiedForPortal(
      lead.leadStatus.name,
      app.email,
      app.emailVerificationType,
    );
    if (!emailVerified) {
      throw new BadRequestException('Verify your email before accepting loan documents.');
    }

    const out = await this.sendOtp.execute(
      { type: OTP_TYPE.MOBILE, value: customer.mobileNumber } as SendOtpDto,
      readClientIp(req),
      session,
      { smsTemplateId: SMS_TEMPLATE_ID.ESIGN_OTP, leadId: lead.id },
    );
    return {
      requestId: out.requestId,
      maskedMobile: out.maskedValue,
      resendAfterSeconds: out.resendAfterSeconds,
      resendAvailableAt: out.resendAvailableAt,
      expiresAt: out.expiresAt,
      ...(out.debugOtp ? { debugOtp: out.debugOtp } : {}),
    };
  }
}
