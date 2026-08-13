import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { readClientIp } from '../../../../common/http/client-ip.util';
import { isLeadEmailVerifiedForPortal } from '../../../../common/mappers/customer-portal-profile.mapper';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { LoanDocumentApplicationService } from '../services/loan-document-application.service';

/**
 * Records that the customer reviewed loan documents on /loan-documents (review-only).
 * Legal acceptance is eSign OTP after references — not this step.
 */
@Injectable()
export class AcknowledgeLoanDocumentsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly loanDocs: LoanDocumentApplicationService,
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

    if (app.loanDocumentsReviewedAt) {
      return {
        success: true as const,
        reviewedAt: app.loanDocumentsReviewedAt.toISOString(),
      };
    }

    const emailVerified = isLeadEmailVerifiedForPortal(
      lead.leadStatus.name,
      app.email,
      app.emailVerificationType,
    );
    if (!emailVerified) {
      throw new BadRequestException('Verify your email before reviewing loan documents.');
    }

    if (!app.details?.selectedLoanAmount || !app.details?.expectedRepaymentDays) {
      throw new BadRequestException('Complete loan selection before reviewing documents.');
    }

    const reviewedAt = new Date();
    const ip = readClientIp(req);

    await this.prisma.client.$executeRaw`
      UPDATE application_detail
      SET
        loan_documents_reviewed_at = ${reviewedAt},
        loan_documents_reviewed_ip = ${ip ?? null}
      WHERE application_id = ${app.id}
    `;

    return { success: true as const, reviewedAt: reviewedAt.toISOString() };
  }
}
