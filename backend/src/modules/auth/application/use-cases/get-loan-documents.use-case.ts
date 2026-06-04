import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { LOAN_DOCUMENT_TYPE } from '../../../../common/constants/loan-document.constants';
import { isLeadEmailVerifiedForPortal } from '../../../../common/mappers/customer-portal-profile.mapper';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { LoanDocumentApplicationService } from '../services/loan-document-application.service';

@Injectable()
export class GetLoanDocumentsUseCase {
  constructor(
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

    const emailVerified = isLeadEmailVerifiedForPortal(
      lead.leadStatus.name,
      app.email,
      app.emailVerificationType,
    );
    if (!emailVerified) {
      throw new BadRequestException('Verify your email before reviewing loan documents.');
    }

    if (!app.details?.loanAmount || !app.details?.loanTenure) {
      throw new BadRequestException('Complete loan selection before reviewing documents.');
    }

    const merge = this.loanDocs.buildMergeInput({ customer: ctx.customer, lead: ctx.lead, application: app });
    const docType = LOAN_DOCUMENT_TYPE.KEY_FACT;
    const existing = this.loanDocs.relativePathForType(docType, app);
    await this.loanDocs.ensurePdf(docType, customer.uuid, app.uuid, app.id, merge, existing);

    const documents = [docType].map((type) => ({
      type,
      title: this.loanDocs.documentTitle(type),
      pdfUrl: this.loanDocs.pdfUrlFragment(type),
    }));

    return {
      accepted: app.loanDocumentsAcceptedAt != null,
      acceptedAt: app.loanDocumentsAcceptedAt?.toISOString() ?? null,
      documents,
    };
  }
}
