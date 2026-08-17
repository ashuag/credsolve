import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LOAN_DOCUMENT_TYPE, type LoanDocumentType } from '../../../../common/constants/loan-document.constants';
import { isLeadEmailVerifiedForPortal } from '../../../../common/mappers/customer-portal-profile.mapper';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { LoanDocumentApplicationService } from '../services/loan-document-application.service';

const ALLOWED: LoanDocumentType[] = [LOAN_DOCUMENT_TYPE.KEY_FACT];

@Injectable()
export class ServeLoanDocumentHtmlUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly loanDocs: LoanDocumentApplicationService,
  ) {}

  async execute(req: Request, res: Response, docTypeRaw: string): Promise<void> {
    if (!ALLOWED.includes(docTypeRaw as LoanDocumentType)) {
      throw new BadRequestException('Unknown loan document type.');
    }

    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) throw new UnauthorizedException('Customer not found.');

    const lead = await this.leads.findActiveByCustomerId(customer.id);
    if (!lead) throw new NotFoundException('No active application.');

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

    if (!app.details?.selectedLoanAmount || !app.details?.expectedRepaymentDays) {
      throw new BadRequestException('Complete loan selection before reviewing documents.');
    }

    const merge = this.loanDocs.buildMergeInput({
      customer: ctx.customer,
      lead: ctx.lead,
      application: app,
    });
    const html = await this.loanDocs.renderPreviewHtml(merge);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=120');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'");
    res.send(html);
  }
}
