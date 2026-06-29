import { Injectable, NotFoundException } from '@nestjs/common';
import { computeInterestAmountFromLoanDetail } from '../../../../common/loan/loan-calculation.util';
import { computeFeeAmountsFromLoanDetail } from '../../../../common/loan/loan-disbursement-view.util';
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

type ApplicationDetailsRow = {
  emailId: string | null;
  emailVerificationType: string | null;
  loanDocumentsAcceptedAt: Date | null;
  loanDocumentsAcceptedIp: string | null;
  keyFactPdfRelativePath: string | null;
  loanAgreementPdfRelativePath: string | null;
  selectedLoanAmount: { toString(): string } | null;
  interestRate: { toString(): string } | null;
  processingFeePercentage: { toString(): string } | null;
  gstPercentage: { toString(): string } | null;
  expectedRepaymentDays: number | null;
  expectedRepaymentDate: Date | null;
  reasonForLoan: { name: string } | null;
};

export type LoanDocumentApplicationContext = {
  id: bigint;
  uuid: string;
  email: string | null;
  emailVerificationType: string | null;
  loanDocumentsAcceptedAt: Date | null;
  loanDocumentsAcceptedIp: string | null;
  keyFactPdfRelativePath: string | null;
  loanAgreementPdfRelativePath: string | null;
  details: ApplicationDetailsRow | null;
};

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

    const applicationRow = await this.prisma.client.application.findFirst({
      where: { leadId, customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        details: {
          select: {
            emailId: true,
            emailVerificationType: true,
            loanDocumentsAcceptedAt: true,
            loanDocumentsAcceptedIp: true,
            keyFactPdfRelativePath: true,
            loanAgreementPdfRelativePath: true,
            selectedLoanAmount: true,
            interestRate: true,
            processingFeePercentage: true,
            gstPercentage: true,
            expectedRepaymentDays: true,
            expectedRepaymentDate: true,
            reasonForLoan: { select: { name: true } },
          },
        },
      },
    });
    if (!applicationRow) throw new NotFoundException('No application found for this lead.');

    const details = applicationRow.details;
    const application: LoanDocumentApplicationContext = {
      id: applicationRow.id,
      uuid: applicationRow.uuid,
      email: details?.emailId ?? null,
      emailVerificationType: details?.emailVerificationType ?? null,
      loanDocumentsAcceptedAt: details?.loanDocumentsAcceptedAt ?? null,
      loanDocumentsAcceptedIp: details?.loanDocumentsAcceptedIp ?? null,
      keyFactPdfRelativePath: details?.keyFactPdfRelativePath ?? null,
      loanAgreementPdfRelativePath: details?.loanAgreementPdfRelativePath ?? null,
      details,
    };

    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
      select: {
        leadDetail: {
          select: {
            panNumber: true,
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
      leadDetail: {
        panNumber: string | null;
        fullName: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        pincode: string | null;
        city: { name: string } | null;
      } | null;
    } | null;
    application: {
      uuid: string;
      loanDocumentsAcceptedIp?: string | null;
      loanDocumentsAcceptedAt?: Date | null;
      details: ApplicationDetailsRow | null;
    };
    acceptanceIpAddress?: string | null;
    acceptanceSignedAt?: Date | null;
  }): LoanDocumentMergeInput {
    const detail = params.lead?.leadDetail;
    const appDetails = params.application.details;
    const tenureDays = appDetails?.expectedRepaymentDays ?? null;
    const fees = computeFeeAmountsFromLoanDetail(appDetails);
    const interestAmount =
      fees.interestAmount
      ?? computeInterestAmountFromLoanDetail(appDetails, tenureDays);

    return {
      fullName: detail?.fullName ?? null,
      mobileNumber: params.customer.mobileNumber,
      panNumber: params.lead?.leadDetail?.panNumber ?? null,
      addressLine1: detail?.addressLine1 ?? null,
      addressLine2: detail?.addressLine2 ?? null,
      currentCity: detail?.city?.name ?? null,
      pincode: detail?.pincode ?? null,
      loanAmountInr: appDetails?.selectedLoanAmount?.toString() ?? null,
      loanPurpose: appDetails?.reasonForLoan?.name ?? null,
      interestRatePerDayPercent: appDetails?.interestRate?.toString() ?? null,
      interestAmountInr: interestAmount != null ? interestAmount.toFixed(2) : null,
      processingFeeAmountInr:
        fees.processingFeeAmount != null ? fees.processingFeeAmount.toFixed(2) : null,
      gstAmountInr: fees.gstAmount != null ? fees.gstAmount.toFixed(2) : null,
      loanTenureDays: tenureDays,
      loanMaturityDate: appDetails?.expectedRepaymentDate ?? null,
      applicationUuid: params.application.uuid,
      processingFeePercent: toNumber(appDetails?.processingFeePercentage?.toString() ?? null),
      acceptanceIpAddress:
        params.acceptanceIpAddress?.trim()
        ?? params.application.loanDocumentsAcceptedIp?.trim()
        ?? appDetails?.loanDocumentsAcceptedIp?.trim()
        ?? null,
      acceptanceSignedAt:
        params.acceptanceSignedAt
        ?? params.application.loanDocumentsAcceptedAt
        ?? appDetails?.loanDocumentsAcceptedAt
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

    await this.prisma.client.applicationDetail.upsert({
      where: { applicationId },
      create: { applicationId, ...data },
      update: data,
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
