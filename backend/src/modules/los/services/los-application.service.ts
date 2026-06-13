import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { BureauReportPdfService } from '../../../common/cibil/bureau-report-pdf.service';
import { isDigilockerAadhaarCaptureComplete } from '../../../common/kyc/aadhaar-vendor-parse.util';
import { extractProfileFromDigilockerFormJson } from '../../../common/kyc/digilocker-form-profile.util';
import { appendPhotoCacheBuster } from '../../../common/kyc/kyc-photo-url.util';
import { KycFilesService } from '../../../common/kyc/kyc-files.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatLosPersonName } from '../format-los-person-name';
import { LoanDocumentApplicationService } from '../../auth/application/services/loan-document-application.service';
import { LOAN_DOCUMENT_TYPE, type LoanDocumentType } from '../../../common/constants/loan-document.constants';

function displayName(name: string, custom: string | null): string {
  return (custom?.trim() || name).trim();
}

function sumDecimalAmounts(parts: Array<Prisma.Decimal | null | undefined>): string | null {
  let total = 0;
  let any = false;
  for (const part of parts) {
    if (part == null) continue;
    any = true;
    total += part.toNumber();
  }
  if (!any) return null;
  return total.toFixed(2);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function pickAadhaarString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function formatAadhaarDob(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function buildLosAadhaarDetail(formJson: unknown): {
  fullName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  maskedAadhaar: string | null;
} | null {
  if (!isDigilockerAadhaarCaptureComplete(formJson) || !isRecord(formJson)) return null;

  const identity = extractProfileFromDigilockerFormJson(formJson);
  const gender = pickAadhaarString(formJson, ['gender', 'Gender']);
  const maskedAadhaar = pickAadhaarString(formJson, [
    'maskedAadhaar',
    'masked_aadhaar',
    'uid',
    'aadhaarNumber',
    'aadhaar_number',
    'aadhaar',
  ]);
  const addressParts = [
    pickAadhaarString(formJson, ['address', 'fullAddress', 'full_address', 'residentAddress', 'resident_address']),
    pickAadhaarString(formJson, ['house', 'houseNo', 'house_no']),
    pickAadhaarString(formJson, ['street', 'streetName', 'street_name']),
    pickAadhaarString(formJson, ['landmark']),
    pickAadhaarString(formJson, ['locality', 'vtc', 'villageTownCity']),
    pickAadhaarString(formJson, ['district', 'dist']),
    pickAadhaarString(formJson, ['state']),
    pickAadhaarString(formJson, ['pincode', 'pin', 'pinCode']),
  ].filter((part): part is string => Boolean(part));
  const address = addressParts.length > 0 ? [...new Set(addressParts)].join(', ') : null;

  return {
    fullName: formatLosPersonName(identity.fullName),
    dateOfBirth: formatAadhaarDob(identity.dateOfBirth),
    gender,
    address,
    maskedAadhaar,
  };
}

function deriveGstPercent(
  processingFeeAmount: Prisma.Decimal | null | undefined,
  gstAmount: Prisma.Decimal | null | undefined,
): string | null {
  if (processingFeeAmount == null || gstAmount == null) return null;
  const fee = processingFeeAmount.toNumber();
  if (fee <= 0) return null;
  return ((gstAmount.toNumber() / fee) * 100).toFixed(2);
}

function maskBankDetails(bankName: string | null | undefined, accountNumber: string | null | undefined, ifscCode: string | null | undefined): string | null {
  const bank = bankName?.trim();
  const tail = accountNumber?.replace(/\D/g, '').slice(-4);
  const ifsc = ifscCode?.trim().toUpperCase();
  if (bank && tail && ifsc) return `${bank} ••••${tail} (${ifsc})`;
  if (bank && tail) return `${bank} ••••${tail}`;
  if (bank && ifsc) return `${bank} (${ifsc})`;
  if (bank) return bank;
  if (tail && ifsc) return `••••${tail} (${ifsc})`;
  if (tail) return `Account ••••${tail}`;
  if (ifsc) return ifsc;
  return null;
}

function applicationKycStatusLabel(code: number): string {
  switch (code) {
    case 0:
      return 'Not done';
    case 1:
      return 'Completed';
    case 2:
      return 'Failed';
    case 3:
      return 'Technical issue';
    default:
      return `Unknown (${code})`;
  }
}

@Injectable()
export class LosApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bureauReportPdf: BureauReportPdfService,
    private readonly kycFiles: KycFilesService,
    private readonly loanDocs: LoanDocumentApplicationService,
  ) {}

  async listApplications() {
    const applications = await this.prisma.client.application.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { uuid: true, mobileNumber: true } },
        lead: { select: { uuid: true, leadDetail: { select: { fullName: true } } } },
        applicationStatus: { select: { name: true, displayName: true } },
        details: {
          select: {
            loanAmount: true,
            interestAmount: true,
            processingFee: true,
            processingFeeAmount: true,
            gstAmount: true,
            loanMaturityDate: true,
          },
        },
        eligibility: { select: { cibilScore: true, approvedAmount: true } },
        disbursement: { select: { bankName: true, accountNumber: true, ifscCode: true } },
      },
      take: 500,
    });

    return applications.map((application) => {
      const details = application.details;
      const repaymentAmount = details
        ? sumDecimalAmounts([
            details.loanAmount,
            details.interestAmount,
            details.processingFeeAmount,
            details.gstAmount,
          ])
        : null;
      const eligibleLoanAmount =
        application.eligibility?.approvedAmount?.toString()
        ?? application.preApprovedLoanAmount?.toString()
        ?? null;

      return {
        uuid: application.uuid,
        customerUuid: application.customer.uuid,
        leadUuid: application.lead.uuid,
        mobileNumber: application.customer.mobileNumber,
        email: application.email,
        fullName: formatLosPersonName(application.lead.leadDetail?.fullName),
        cibilScore: application.eligibility?.cibilScore ?? null,
        eligibleLoanAmount,
        selectedLoanAmount: details?.loanAmount?.toString() ?? null,
        repayDate: details?.loanMaturityDate?.toISOString().slice(0, 10) ?? null,
        repaymentAmount,
        emi: repaymentAmount,
        processingFeePercent: details?.processingFee?.toString() ?? null,
        processingFeeAmount: details?.processingFeeAmount?.toString() ?? null,
        bankDetails: maskBankDetails(
          application.disbursement?.bankName,
          application.disbursement?.accountNumber,
          application.disbursement?.ifscCode,
        ),
        statusCode: application.applicationStatus.name,
        statusLabel: displayName(application.applicationStatus.name, application.applicationStatus.displayName),
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
      };
    });
  }

  async getApplicationDetails(applicationUuid: string) {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      include: {
        customer: { select: { uuid: true, mobileNumber: true } },
        lead: {
          include: {
            leadStatus: { select: { name: true, displayName: true } },
            source: { select: { name: true, type: true } },
            leadReferences: {
              orderBy: { referenceIndex: 'asc' },
              select: {
                referenceIndex: true,
                fullName: true,
                mobileNumber: true,
                relation: { select: { name: true } },
              },
            },
            leadDetail: {
              include: {
                city: { select: { name: true, state: { select: { name: true, code: true } } } },
                gender: { select: { name: true } },
                occupation: { select: { name: true } },
              },
            },
          },
        },
        applicationStatus: { select: { name: true, displayName: true } },
        details: {
          include: {
            reasonForLoan: { select: { name: true } },
          },
        },
        eligibility: true,
        agreement: true,
        disbursement: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const lead = application.lead;
    const detail = lead.leadDetail;

    const bureauReportRow = await this.prisma.client.bureauReport.findFirst({
      where: { leadId: application.leadId },
      orderBy: { createdAt: 'desc' },
      select: {
        uuid: true,
        cibilScore: true,
        htmlUrl: true,
        createdAt: true,
      },
    });

    let bureauReportPdfUrl: string | null = null;
    if (bureauReportRow) {
      const pdfResult = await this.bureauReportPdf.ensurePdfForLead({
        leadId: application.leadId,
        customerUuid: application.customer.uuid,
      });
      bureauReportPdfUrl = pdfResult?.publicUrl ?? null;
    }

    const selfieRelativePath = application.selfieRelativePath?.trim() || null;
    const aadhaarPhotoRelativePath = application.aadhaarPhotoRelativePath?.trim() || null;
    const photoVersion = application.updatedAt.getTime();
    const [selfiePublicUrl, aadhaarPublicUrl] = await Promise.all([
      selfieRelativePath ? this.kycFiles.resolvePublicReadUrl(selfieRelativePath) : Promise.resolve(null),
      aadhaarPhotoRelativePath ? this.kycFiles.resolvePublicReadUrl(aadhaarPhotoRelativePath) : Promise.resolve(null),
    ]);
    const bust = (url: string | null) =>
      url && /^https?:\/\//i.test(url) ? appendPhotoCacheBuster(url, photoVersion) : url;

    return {
      uuid: application.uuid,
      customerUuid: application.customer.uuid,
      leadUuid: lead.uuid,
      mobileNumber: application.customer.mobileNumber,
      email: application.email,
      emailVerifiedAt: application.emailVerifiedAt?.toISOString() ?? null,
      statusCode: application.applicationStatus.name,
      statusLabel: displayName(application.applicationStatus.name, application.applicationStatus.displayName),
      kycStatus: application.kycStatus,
      kycStatusLabel: applicationKycStatusLabel(application.kycStatus),
      kycCompletedAt: application.kycCompletedAt?.toISOString() ?? null,
      livenessPassed: application.livenessPassed,
      livenessCheckedAt: application.livenessCheckedAt?.toISOString() ?? null,
      kycPhotos: {
        selfiePath: selfieRelativePath,
        aadhaarPhotoPath: aadhaarPhotoRelativePath,
        selfieUrl:
          bust(selfiePublicUrl) ??
          (selfieRelativePath ? `/applications/${application.uuid}/kyc/selfie-photo` : null),
        aadhaarPhotoUrl:
          bust(aadhaarPublicUrl) ??
          (aadhaarPhotoRelativePath ? `/applications/${application.uuid}/kyc/aadhaar-photo` : null),
      },
      preApprovedLoanAmount: application.preApprovedLoanAmount?.toString() ?? null,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      lead: {
        uuid: lead.uuid,
        statusCode: lead.leadStatus.name,
        statusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
        sourceName: lead.source?.name ?? null,
        sourceType: lead.source?.type ?? null,
        panNumber: lead.panNumber,
        panVerified: lead.panVerified,
        bureauFetched: lead.bureauFetched,
        profile: detail
          ? {
              fullName: formatLosPersonName(detail.fullName),
              dateOfBirth: detail.dateOfBirth ? detail.dateOfBirth.toISOString().slice(0, 10) : null,
              panNumber: lead.panNumber,
              pincode: detail.pincode,
              addressLine1: detail.addressLine1,
              addressLine2: detail.addressLine2,
              city: detail.city?.name ?? null,
              state: detail.city?.state?.name ?? null,
              stateCode: detail.city?.state?.code ?? null,
              gender: detail.gender?.name ?? null,
              occupation: detail.occupation?.name ?? null,
              netMonthlyIncome: detail.netMonthlyIncome?.toString() ?? null,
              annualTurnover: detail.annualTurnover?.toString() ?? null,
              annualProfit: detail.annualProfit?.toString() ?? null,
              cibilConsentAt: detail.cibilConsentAt?.toISOString() ?? null,
            }
          : null,
      },
      referencesCount: lead.leadReferences.length,
      references: lead.leadReferences.map((ref) => ({
        referenceIndex: ref.referenceIndex,
        fullName: formatLosPersonName(ref.fullName) ?? ref.fullName,
        mobileNumber: ref.mobileNumber,
        relation: ref.relation.name,
      })),
      aadhaarDetail: buildLosAadhaarDetail(application.digilockerAadhaarFormJson),
      details: application.details
        ? (() => {
            const details = application.details;
            const repaymentAmount = sumDecimalAmounts([
              details.loanAmount,
              details.interestAmount,
              details.processingFeeAmount,
              details.gstAmount,
            ]);
            const disbursedAmount =
              details.loanAmount != null
                ? (
                    details.loanAmount.toNumber()
                    - (details.processingFeeAmount?.toNumber() ?? 0)
                    - (details.gstAmount?.toNumber() ?? 0)
                  ).toFixed(2)
                : null;
            return {
              reasonForLoan: details.reasonForLoan?.name ?? null,
              loanAmount: details.loanAmount?.toString() ?? null,
              loanTenure: details.loanTenure,
              interestRate: details.interestRate?.toString() ?? null,
              interestAmount: details.interestAmount?.toString() ?? null,
              processingFee: details.processingFee?.toString() ?? null,
              processingFeeAmount: details.processingFeeAmount?.toString() ?? null,
              gstPercent: deriveGstPercent(details.processingFeeAmount, details.gstAmount),
              gstAmount: details.gstAmount?.toString() ?? null,
              disbursedAmount,
              repaymentAmount,
              loanDisbursementDate: details.loanDisbursementDate?.toISOString().slice(0, 10) ?? null,
              loanMaturityDate: details.loanMaturityDate?.toISOString().slice(0, 10) ?? null,
            };
          })()
        : null,
      eligibility: application.eligibility
        ? {
            isEligible: application.eligibility.isEligible,
            approvedAmount: application.eligibility.approvedAmount?.toString() ?? null,
            cibilScore: application.eligibility.cibilScore,
            ineligibleReason: application.eligibility.ineligibleReason,
            checkedAt: application.eligibility.checkedAt.toISOString(),
          }
        : null,
      bureauReport: bureauReportRow
        ? {
            uuid: bureauReportRow.uuid,
            cibilScore: bureauReportRow.cibilScore,
            htmlUrl: bureauReportRow.htmlUrl,
            reportPdfUrl: bureauReportPdfUrl,
            fetchedAt: bureauReportRow.createdAt.toISOString(),
          }
        : null,
      agreement: application.agreement
        ? {
            documentName: application.agreement.documentName,
            signedAt: application.agreement.signedAt?.toISOString() ?? null,
            ipAddress: application.agreement.ipAddress,
          }
        : null,
      disbursement: application.disbursement
        ? {
            amount: application.disbursement.amount?.toString() ?? null,
            accountNumber: application.disbursement.accountNumber,
            ifscCode: application.disbursement.ifscCode,
            bankName: application.disbursement.bankName,
            utr: application.disbursement.utr,
            disbursedAt: application.disbursement.disbursedAt?.toISOString() ?? null,
          }
        : null,
      loanDocuments: {
        keyFactReady: !!application.keyFactPdfRelativePath?.trim(),
        keyFactEsigned: application.keyFactEsigned ?? false,
        loanAgreementReady: !!application.loanAgreementPdfRelativePath?.trim(),
        acceptedAt: application.loanDocumentsAcceptedAt?.toISOString() ?? null,
      },
    };
  }

  async serveApplicationSelfiePhoto(applicationUuid: string, res: Response): Promise<void> {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: { selfieRelativePath: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    const rel = application.selfieRelativePath?.trim();
    if (!rel) {
      throw new NotFoundException('Selfie is not saved yet.');
    }
    await this.streamKycPhoto(rel, res);
  }

  async serveApplicationAadhaarPhoto(applicationUuid: string, res: Response): Promise<void> {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: { aadhaarPhotoRelativePath: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    const rel = application.aadhaarPhotoRelativePath?.trim();
    if (!rel) {
      throw new NotFoundException('Aadhaar photo is not available yet.');
    }
    await this.streamKycPhoto(rel, res);
  }

  async serveApplicationLoanDocument(applicationUuid: string, docTypeRaw: string, res: Response): Promise<void> {
    const allowed: LoanDocumentType[] = [LOAN_DOCUMENT_TYPE.KEY_FACT];
    if (!allowed.includes(docTypeRaw as LoanDocumentType)) {
      throw new BadRequestException('Unknown loan document type.');
    }
    const docType = docTypeRaw as LoanDocumentType;

    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: { keyFactPdfRelativePath: true, loanAgreementPdfRelativePath: true },
    });
    if (!application) throw new NotFoundException('Application not found.');

    const rel = this.loanDocs.relativePathForType(docType, application)?.trim() ?? null;
    if (!rel) throw new NotFoundException('This document has not been generated yet.');

    const buf = await this.kycFiles.readBytes(rel);
    const title = this.loanDocs.documentTitle(docType);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${title}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buf);
  }

  private async streamKycPhoto(relativePath: string, res: Response): Promise<void> {
    const buf = await this.kycFiles.readBytes(relativePath);
    const lower = relativePath.toLowerCase();
    const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buf);
  }

  async getApplicationCibilReport(applicationUuid: string) {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: {
        leadId: true,
        customer: { select: { uuid: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const bureauReportRow = await this.prisma.client.bureauReport.findFirst({
      where: { leadId: application.leadId },
      orderBy: { createdAt: 'desc' },
      select: {
        uuid: true,
        htmlUrl: true,
        rawPayload: true,
        createdAt: true,
      },
    });

    if (!bureauReportRow) {
      throw new NotFoundException('No bureau report found for this application');
    }

    if (bureauReportRow.rawPayload == null) {
      throw new NotFoundException('Bureau report has no stored JSON payload');
    }

    const pdfResult = await this.bureauReportPdf.ensurePdfForLead({
      leadId: application.leadId,
      customerUuid: application.customer.uuid,
    });

    const report = await this.bureauReportPdf.buildReportViewData(bureauReportRow.rawPayload);

    return {
      bureauReportUuid: bureauReportRow.uuid,
      fetchedAt: bureauReportRow.createdAt.toISOString(),
      reportPdfUrl: pdfResult?.publicUrl ?? null,
      htmlUrl: bureauReportRow.htmlUrl,
      rawPayload: bureauReportRow.rawPayload,
      report,
    };
  }

  async generateLoanDocuments(applicationUuid: string) {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: {
        id: true,
        uuid: true,
        email: true,
        emailVerificationType: true,
        loanDocumentsAcceptedAt: true,
        keyFactPdfRelativePath: true,
        keyFactEsigned: true,
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
        customer: { select: { id: true, uuid: true, mobileNumber: true } },
        lead: {
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
        },
      },
    });

    if (!application) throw new NotFoundException(`Application ${applicationUuid} not found`);
    if (!application.details?.loanAmount || !application.details?.loanTenure) {
      throw new NotFoundException('Loan selection is incomplete — cannot generate documents.');
    }

    const merge = this.loanDocs.buildMergeInput({
      customer: application.customer,
      lead: application.lead,
      application,
    });

    const docType = LOAN_DOCUMENT_TYPE.KEY_FACT;
    const existing = this.loanDocs.relativePathForType(docType, application);
    await this.loanDocs.ensurePdf(
      docType,
      application.customer.uuid,
      application.uuid,
      application.id,
      merge,
      existing,
      true,
      application.loanDocumentsAcceptedAt != null,
    );
    const generated = [docType];

    return { applicationUuid, generated };
  }
}
