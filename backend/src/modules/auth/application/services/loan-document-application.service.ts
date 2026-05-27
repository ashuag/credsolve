import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LOAN_DOCUMENT_PDF_FILES,
  LOAN_DOCUMENT_TYPE,
  type LoanDocumentType,
} from '../../../../common/constants/loan-document.constants';
import { LoanDocumentGeneratorService } from '../../../../common/loan-documents/loan-document-generator.service';
import type { LoanDocumentMergeInput } from '../../../../common/loan-documents/loan-document.types';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class LoanDocumentApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kycFiles: KycFilesService,
    private readonly generator: LoanDocumentGeneratorService,
  ) {}

  async loadApplicationContext(customerUuid: string, leadId: bigint) {
    const customer = await this.prisma.client.customer.findUnique({
      where: { uuid: customerUuid },
      select: { id: true, uuid: true, mobileNumber: true },
    });
    if (!customer) throw new NotFoundException('Customer not found.');

    const application = await this.prisma.client.application.findFirst({
      where: { leadId, customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        email: true,
        emailVerificationType: true,
        loanDocumentsAcceptedAt: true,
        keyFactPdfRelativePath: true,
        loanAgreementPdfRelativePath: true,
        details: {
          select: {
            loanAmount: true,
            loanTenure: true,
            loanMaturityDate: true,
            interestRate: true,
            interestAmount: true,
            processingFeeAmount: true,
            gstAmount: true,
            reasonForLoan: { select: { name: true } },
          },
        },
      },
    });
    if (!application) throw new NotFoundException('No application found for this lead.');

    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
      select: {
        panNumber: true,
        leadDetail: {
          select: {
            fullName: true,
            addressLine1: true,
            addressLine2: true,
            pincode: true,
            city: { select: { name: true } },
          },
        },
      },
    });

    return { customer, application, lead };
  }

  buildMergeInput(params: {
    customer: { mobileNumber: string };
    lead: {
      panNumber: string | null;
      leadDetail: {
        fullName: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        pincode: string | null;
        city: { name: string } | null;
      } | null;
    } | null;
    application: {
      details: {
        loanAmount: { toString(): string } | null;
        loanTenure: number | null;
        loanMaturityDate: Date | null;
        interestRate: { toString(): string } | null;
        interestAmount: { toString(): string } | null;
        processingFeeAmount: { toString(): string } | null;
        gstAmount: { toString(): string } | null;
        reasonForLoan: { name: string } | null;
      } | null;
    };
  }): LoanDocumentMergeInput {
    const detail = params.lead?.leadDetail;
    const appDetails = params.application.details;
    return {
      fullName: detail?.fullName ?? null,
      mobileNumber: params.customer.mobileNumber,
      panNumber: params.lead?.panNumber ?? null,
      addressLine1: detail?.addressLine1 ?? null,
      addressLine2: detail?.addressLine2 ?? null,
      currentCity: detail?.city?.name ?? null,
      pincode: detail?.pincode ?? null,
      loanAmountInr: appDetails?.loanAmount?.toString() ?? null,
      loanPurpose: appDetails?.reasonForLoan?.name ?? null,
      interestRatePerDayPercent: appDetails?.interestRate?.toString() ?? null,
      interestAmountInr: appDetails?.interestAmount?.toString() ?? null,
      processingFeeAmountInr: appDetails?.processingFeeAmount?.toString() ?? null,
      gstAmountInr: appDetails?.gstAmount?.toString() ?? null,
      loanTenureDays: appDetails?.loanTenure ?? null,
      loanMaturityDate: appDetails?.loanMaturityDate ?? null,
    };
  }

  async ensurePdf(
    docType: LoanDocumentType,
    customerUuid: string,
    applicationUuid: string,
    applicationId: bigint,
    merge: LoanDocumentMergeInput,
    existingRelativePath: string | null,
  ): Promise<string> {
    const pdfName = this.generator.pdfFileName(docType) as 'key-fact-statement.pdf' | 'loan-agreement.pdf';
    const rel =
      existingRelativePath?.trim() ||
      this.kycFiles.loanDocumentPdfRelativePath(customerUuid, applicationUuid, pdfName);

    if (existingRelativePath?.trim()) {
      try {
        await this.kycFiles.readBytes(rel);
        return rel;
      } catch {
        // regenerate below
      }
    }

    const pdf = await this.generator.generatePdf(docType, merge);
    await this.kycFiles.writeBytes(rel, pdf);

    const data =
      docType === LOAN_DOCUMENT_TYPE.KEY_FACT
        ? { keyFactPdfRelativePath: rel }
        : { loanAgreementPdfRelativePath: rel };

    await this.prisma.client.application.update({
      where: { id: applicationId },
      data,
    });

    return rel;
  }

  relativePathForType(
    docType: LoanDocumentType,
    application: { keyFactPdfRelativePath: string | null; loanAgreementPdfRelativePath: string | null },
  ): string | null {
    if (docType === LOAN_DOCUMENT_TYPE.KEY_FACT) return application.keyFactPdfRelativePath?.trim() ?? null;
    return application.loanAgreementPdfRelativePath?.trim() ?? null;
  }

  pdfUrlFragment(docType: LoanDocumentType): string {
    return `/auth/loan-documents/${docType}/pdf`;
  }

  documentTitle(docType: LoanDocumentType): string {
    return docType === LOAN_DOCUMENT_TYPE.KEY_FACT
      ? 'Sanction letter cum Key Fact Statement'
      : 'Loan Agreement';
  }

  allPdfNames(): typeof LOAN_DOCUMENT_PDF_FILES {
    return LOAN_DOCUMENT_PDF_FILES;
  }
}
