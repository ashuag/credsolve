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

function toNumber(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

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
        agreement: {
          select: {
            ipAddress: true,
            signedAt: true,
          },
        },
        details: {
          select: {
            loanAmount: true,
            loanTenure: true,
            loanMaturityDate: true,
            interestRate: true,
            interestAmount: true,
            processingFee: true,
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
      uuid: string;
      agreement?: {
        ipAddress: string | null;
        signedAt: Date | null;
      } | null;
      details: {
        loanAmount: { toString(): string } | null;
        loanTenure: number | null;
        loanMaturityDate: Date | null;
        interestRate: { toString(): string } | null;
        interestAmount: { toString(): string } | null;
        processingFee: { toString(): string } | null;
        processingFeeAmount: { toString(): string } | null;
        gstAmount: { toString(): string } | null;
        reasonForLoan: { name: string } | null;
      } | null;
    };
    acceptanceIpAddress?: string | null;
    acceptanceSignedAt?: Date | null;
  }): LoanDocumentMergeInput {
    const detail = params.lead?.leadDetail;
    const appDetails = params.application.details;
    const loanAmount = toNumber(appDetails?.loanAmount?.toString() ?? null);
    const processingFeeAmount = toNumber(appDetails?.processingFeeAmount?.toString() ?? null);
    const processingFeePercent =
      loanAmount != null && loanAmount > 0 && processingFeeAmount != null
        ? (processingFeeAmount / loanAmount) * 100
        : toNumber(appDetails?.processingFee?.toString() ?? null);

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
      applicationUuid: params.application.uuid,
      processingFeePercent,
      acceptanceIpAddress:
        params.application.agreement?.ipAddress?.trim()
        ?? params.acceptanceIpAddress?.trim()
        ?? null,
      acceptanceSignedAt:
        params.application.agreement?.signedAt
        ?? params.acceptanceSignedAt
        ?? null,
    };
  }

  async ensurePdf(
    docType: LoanDocumentType,
    customerUuid: string,
    applicationUuid: string,
    applicationId: bigint,
    merge: LoanDocumentMergeInput,
    existingRelativePath: string | null,
    forceRegenerate = false,
    digitallySign = false,
  ): Promise<string> {
    const pdfName = this.generator.pdfFileName(docType) as 'key-fact-statement.pdf' | 'loan-agreement.pdf';
    const rel =
      existingRelativePath?.trim() ||
      this.kycFiles.loanDocumentPdfRelativePath(customerUuid, applicationUuid, pdfName);

    if (!forceRegenerate && existingRelativePath?.trim()) {
      if (await this.kycFiles.exists(rel)) {
        return rel;
      }
    }

    const { pdf, esigned } = await this.generator.generatePdf(docType, merge, digitallySign);
    await this.kycFiles.writeBytes(rel, pdf);

    const data =
      docType === LOAN_DOCUMENT_TYPE.KEY_FACT
        ? { keyFactPdfRelativePath: rel, keyFactEsigned: esigned }
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
