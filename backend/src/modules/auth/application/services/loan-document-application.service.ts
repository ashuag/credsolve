import { Injectable, NotFoundException } from '@nestjs/common';
import { computeInterestAmountFromLoanDetail } from '../../../../common/loan/loan-calculation.util';
import { computeFeeAmountsFromLoanDetail } from '../../../../common/loan/loan-disbursement-view.util';
import { syncExpectedRepaymentDateUntilDisbursed } from '../../../../common/loan/repayment-due-date.util';
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
  loanDocumentsReviewedAt?: Date | null;
  loanDocumentsReviewedIp?: string | null;
  keyFactPdfRelativePath: string | null;
  keyFactDisbursementPdfRelativePath?: string | null;
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
  applicationNumber: string;
  email: string | null;
  emailVerificationType: string | null;
  loanDocumentsAcceptedAt: Date | null;
  loanDocumentsAcceptedIp: string | null;
  loanDocumentsReviewedAt: Date | null;
  loanDocumentsReviewedIp: string | null;
  keyFactPdfRelativePath: string | null;
  keyFactDisbursementPdfRelativePath?: string | null;
  loanAgreementPdfRelativePath: string | null;
  details: ApplicationDetailsRow | null;
};

@Injectable()
export class LoanDocumentApplicationService {
  /** Coalesce concurrent generate/upload for the same application + doc type. */
  private readonly inflightPdf = new Map<string, Promise<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly kycFiles: KycFilesService,
    private readonly generator: LoanDocumentGeneratorService,
  ) {}

  /**
   * Keep expected repay date in sync with today's rule until disbursement.
   * Unsigned KFS/agreement files are dropped so they regenerate with the new date.
   */
  async applyLiveRepaymentUntilDisbursed<T extends ApplicationDetailsRow>(params: {
    applicationId: bigint;
    disbursed: boolean;
    details: T | null;
  }): Promise<T | null> {
    const details = params.details;
    if (!details?.expectedRepaymentDate || params.disbursed) {
      return details;
    }

    const synced = await syncExpectedRepaymentDateUntilDisbursed(this.prisma.client, {
      applicationId: params.applicationId,
      storedDate: details.expectedRepaymentDate,
      storedDays: details.expectedRepaymentDays,
      disbursed: false,
      invalidateUnsignedDocuments: !details.loanDocumentsAcceptedAt,
    });
    if (synced.expectedRepaymentDate) {
      details.expectedRepaymentDate = synced.expectedRepaymentDate;
      details.expectedRepaymentDays = synced.expectedRepaymentDays;
    }
    if (synced.changed && !details.loanDocumentsAcceptedAt) {
      details.keyFactPdfRelativePath = null;
      details.loanAgreementPdfRelativePath = null;
      details.loanDocumentsReviewedAt = null;
      details.loanDocumentsReviewedIp = null;
    }
    return details;
  }

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
        applicationNumber: true,
        details: {
          select: {
            emailId: true,
            emailVerificationType: true,
            loanDocumentsAcceptedAt: true,
            loanDocumentsAcceptedIp: true,
            keyFactPdfRelativePath: true,
            keyFactDisbursementPdfRelativePath: true,
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
        loanAccount: { select: { id: true } },
      },
    });
    if (!applicationRow) throw new NotFoundException('No application found for this lead.');

    const reviewedRows = await this.prisma.client.$queryRaw<
      Array<{ loanDocumentsReviewedAt: Date | null; loanDocumentsReviewedIp: string | null }>
    >`
      SELECT
        loan_documents_reviewed_at AS loanDocumentsReviewedAt,
        loan_documents_reviewed_ip AS loanDocumentsReviewedIp
      FROM application_detail
      WHERE application_id = ${applicationRow.id}
      LIMIT 1
    `;
    const reviewed = reviewedRows[0] ?? {
      loanDocumentsReviewedAt: null,
      loanDocumentsReviewedIp: null,
    };

    const details = applicationRow.details
      ? {
          ...applicationRow.details,
          loanDocumentsReviewedAt: reviewed.loanDocumentsReviewedAt,
          loanDocumentsReviewedIp: reviewed.loanDocumentsReviewedIp,
        }
      : null;

    await this.applyLiveRepaymentUntilDisbursed({
      applicationId: applicationRow.id,
      disbursed: applicationRow.loanAccount != null,
      details,
    });
    const application: LoanDocumentApplicationContext = {
      id: applicationRow.id,
      uuid: applicationRow.uuid,
      applicationNumber: applicationRow.applicationNumber,
      email: details?.emailId ?? null,
      emailVerificationType: details?.emailVerificationType ?? null,
      loanDocumentsAcceptedAt: details?.loanDocumentsAcceptedAt ?? null,
      loanDocumentsAcceptedIp: details?.loanDocumentsAcceptedIp ?? null,
      loanDocumentsReviewedAt: reviewed.loanDocumentsReviewedAt,
      loanDocumentsReviewedIp: reviewed.loanDocumentsReviewedIp,
      keyFactPdfRelativePath: details?.keyFactPdfRelativePath ?? null,
      keyFactDisbursementPdfRelativePath: details?.keyFactDisbursementPdfRelativePath ?? null,
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
      applicationNumber: string;
      loanDocumentsAcceptedIp?: string | null;
      loanDocumentsAcceptedAt?: Date | null;
      details: ApplicationDetailsRow | null;
    };
    acceptanceIpAddress?: string | null;
    acceptanceSignedAt?: Date | null;
  }): LoanDocumentMergeInput {
    const detail = params.lead?.leadDetail;
    const appDetails = params.application.details;
    const fees = computeFeeAmountsFromLoanDetail(appDetails);
    const tenureDays = fees.tenureDays;
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
      applicationNumber: params.application.applicationNumber,
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

  /**
   * Ensures a loan-document PDF exists in storage and is recorded on application_detail.
   * @param createNewFile When true, always write a uniquely named file (never overwrite an existing path).
   *   The DB pointer is updated to the new path; prior files remain in storage.
   */
  async ensurePdf(
    docType: LoanDocumentType,
    customerUuid: string,
    applicationUuid: string,
    applicationId: bigint,
    merge: LoanDocumentMergeInput,
    existingRelativePath: string | null,
    forceRegenerate = false,
    digitallySign = false,
    createNewFile = false,
  ): Promise<string> {
    const key = `${applicationId}:${docType}:${digitallySign ? 1 : 0}:${forceRegenerate ? 1 : 0}:${createNewFile ? 1 : 0}`;
    const pending = this.inflightPdf.get(key);
    if (pending) return pending;

    const work = this.writePdfIfNeeded(
      docType,
      customerUuid,
      applicationUuid,
      applicationId,
      merge,
      existingRelativePath,
      forceRegenerate,
      digitallySign,
      createNewFile,
    ).finally(() => {
      this.inflightPdf.delete(key);
    });
    this.inflightPdf.set(key, work);
    return work;
  }

  private async writePdfIfNeeded(
    docType: LoanDocumentType,
    customerUuid: string,
    applicationUuid: string,
    applicationId: bigint,
    merge: LoanDocumentMergeInput,
    existingRelativePath: string | null,
    forceRegenerate: boolean,
    digitallySign: boolean,
    createNewFile: boolean,
  ): Promise<string> {
    const pdfName = this.generator.pdfFileName(docType);
    const existing = existingRelativePath?.trim() || null;

    if (!createNewFile && !forceRegenerate && existing) {
      if (await this.kycFiles.exists(existing)) {
        return existing;
      }
    }

    const rel = createNewFile
      ? this.uniqueLoanDocumentPdfRelativePath(customerUuid, applicationUuid, pdfName)
      : existing ||
        this.kycFiles.loanDocumentPdfRelativePath(customerUuid, applicationUuid, pdfName);

    const { pdf, esigned } = await this.generator.generatePdf(docType, merge, digitallySign);
    await this.kycFiles.writeBytes(rel, pdf);

    const data =
      docType === LOAN_DOCUMENT_TYPE.KEY_FACT
        ? { keyFactPdfRelativePath: rel, keyFactEsigned: esigned }
        : docType === LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT
          ? { keyFactDisbursementPdfRelativePath: rel, keyFactDisbursementEsigned: esigned }
          : { loanAgreementPdfRelativePath: rel };

    await this.prisma.client.applicationDetail.upsert({
      where: { applicationId },
      create: { applicationId, ...data },
      update: data,
    });

    return rel;
  }

  /** Timestamped path so regenerate never clobbers a prior PDF object. */
  private uniqueLoanDocumentPdfRelativePath(
    customerUuid: string,
    applicationUuid: string,
    pdfFileName: string,
  ): string {
    const base = pdfFileName.replace(/\.pdf$/i, '');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return this.kycFiles.loanDocumentPdfRelativePath(
      customerUuid,
      applicationUuid,
      `${base}-${stamp}.pdf`,
    );
  }

  relativePathForType(
    docType: LoanDocumentType,
    application: {
      keyFactPdfRelativePath: string | null;
      keyFactDisbursementPdfRelativePath?: string | null;
      loanAgreementPdfRelativePath: string | null;
    },
  ): string | null {
    if (docType === LOAN_DOCUMENT_TYPE.KEY_FACT) return application.keyFactPdfRelativePath?.trim() ?? null;
    if (docType === LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT) {
      return application.keyFactDisbursementPdfRelativePath?.trim() ?? null;
    }
    return application.loanAgreementPdfRelativePath?.trim() ?? null;
  }

  pdfUrlFragment(docType: LoanDocumentType): string {
    return `/auth/loan-documents/${docType}/pdf`;
  }

  htmlUrlFragment(docType: LoanDocumentType): string {
    return `/auth/loan-documents/${docType}/html`;
  }

  async renderPreviewHtml(merge: LoanDocumentMergeInput): Promise<string> {
    return this.generator.renderPreviewHtml(merge);
  }

  /** Loan cum Commercial Terms PDF, generated fresh for the post-acceptance email attachment. */
  async generateCommercialTermsPdf(merge: LoanDocumentMergeInput): Promise<Buffer> {
    return this.generator.generateCommercialTermsPdf(merge);
  }

  documentTitle(docType: LoanDocumentType): string {
    if (docType === LOAN_DOCUMENT_TYPE.KEY_FACT) {
      return 'Sanction letter cum Key Fact Statement (acceptance)';
    }
    if (docType === LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT) {
      return 'Sanction letter cum Key Fact Statement and Loan cum Commercial Terms (disbursement)';
    }
    return 'Loan Agreement';
  }

  allPdfNames(): typeof LOAN_DOCUMENT_PDF_FILES {
    return LOAN_DOCUMENT_PDF_FILES;
  }
}
