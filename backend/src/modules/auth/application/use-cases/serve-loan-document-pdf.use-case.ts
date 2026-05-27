import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LOAN_DOCUMENT_TYPE, type LoanDocumentType } from '../../../../common/constants/loan-document.constants';
import { isLeadEmailVerifiedForPortal } from '../../../../common/mappers/customer-portal-profile.mapper';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { LoanDocumentApplicationService } from '../services/loan-document-application.service';

const ALLOWED: LoanDocumentType[] = [LOAN_DOCUMENT_TYPE.KEY_FACT, LOAN_DOCUMENT_TYPE.LOAN_AGREEMENT];

@Injectable()
export class ServeLoanDocumentPdfUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly kycFiles: KycFilesService,
    private readonly loanDocs: LoanDocumentApplicationService,
  ) {}

  async execute(req: Request, res: Response, docTypeRaw: string): Promise<void> {
    if (!ALLOWED.includes(docTypeRaw as LoanDocumentType)) {
      throw new BadRequestException('Unknown loan document type.');
    }
    const docType = docTypeRaw as LoanDocumentType;

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

    const merge = this.loanDocs.buildMergeInput({
      customer: ctx.customer,
      lead: ctx.lead,
      application: app,
    });

    const existing = this.loanDocs.relativePathForType(docType, app);
    const rel = await this.loanDocs.ensurePdf(docType, customer.uuid, app.uuid, app.id, merge, existing);

    const buf = await this.kycFiles.readBytes(rel);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${this.loanDocs.documentTitle(docType)}.pdf"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buf);
  }
}
