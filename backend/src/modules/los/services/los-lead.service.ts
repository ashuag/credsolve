import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
import { APPLICATION_STATUS } from '../../../common/constants/application.constants';
import { BUREAU_FETCHED } from '../../../common/constants/bureau-fetch.constants';
import { LEAD_STATUS } from '../../../common/constants/lead.constants';
import { REJECTION_REASON, toRejectionReasonDto } from '../../../common/constants/rejection-reason.constants';
import { PAN_VERIFIED } from '../../../common/constants/pan-verification.constants';
import { generateLeadNumber } from '../../../common/loan/application-number.util';
import { customerHasOpenLoan } from '../../../common/loan/customer-open-loan.util';
import { computeTenureDays, istCalendarDateUtc } from '../../../common/loan/loan-calculation.util';
import { resolveRepaymentDueDateUtc } from '../../../common/loan/repayment-due-date.util';
import { BureauReportPdfService } from '../../../common/cibil/bureau-report-pdf.service';
import { CibilCreditAssessmentService } from '../../../common/cibil/cibil-credit-assessment.service';
import { KycFilesService } from '../../../common/kyc/kyc-files.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatLosPersonName } from '../format-los-person-name';
import { buildSimpleXlsxWorkbook, type SimpleXlsxCell } from '../../../common/xlsx/simple-xlsx';
import { TENACIO_SERVICE_PAN_NAME_DOB } from '../../../common/vendor/tenacio/tenacio-client.service';

function displayName(name: string, custom: string | null): string {
  return (custom?.trim() || name).trim();
}

function panVerifiedStatusLabel(code: number): string {
  switch (code) {
    case PAN_VERIFIED.NOT_CHECKED:
      return 'Not checked';
    case PAN_VERIFIED.VERIFIED:
      return 'Verified';
    case PAN_VERIFIED.NOT_VERIFIED:
      return 'Not verified';
    case PAN_VERIFIED.API_FAILURE:
      return 'API failure';
    case PAN_VERIFIED.API_DISABLED:
      return 'Disabled';
    default:
      return `Unknown (${code})`;
  }
}

function bureauFetchedStatusLabel(code: number): string {
  switch (code) {
    case BUREAU_FETCHED.NOT_FETCHED:
      return 'Not fetched';
    case BUREAU_FETCHED.SUCCESS:
      return 'Fetched';
    case BUREAU_FETCHED.FAILED:
      return 'Failed';
    default:
      return `Unknown (${code})`;
  }
}

function panNsdlServiceNames(): string[] {
  return [...new Set(
    [(process.env.TENACIO_PAN_NSDL_SERVICE ?? '').trim(), TENACIO_SERVICE_PAN_NAME_DOB].filter(Boolean),
  )];
}

/** Reads Tenacio NSDL `data.nameMatch` from a stored vendor_api_log payload. */
function extractNsdlNameMatch(payload: unknown): boolean | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const data = root.data;
  const nested =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>).nameMatch
      : undefined;
  const value = nested ?? root.nameMatch;
  return typeof value === 'boolean' ? value : null;
}

function toExcelDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function toExcelNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function leadSourceLabel(lead: {
  sourceName: string | null;
  sourceType: string | null;
  utmSource: string | null;
  utmMedium: string | null;
}): string | null {
  if (lead.sourceName) {
    return lead.sourceType ? `${lead.sourceName} · ${lead.sourceType}` : lead.sourceName;
  }
  if (lead.utmSource) {
    return lead.utmMedium ? `${lead.utmSource} · ${lead.utmMedium}` : lead.utmSource;
  }
  return null;
}

const LEAD_DUMP_HEADERS = [
  'Lead ID',
  'Application ID',
  'Name',
  'Mobile',
  'Email',
  'PAN',
  'PAN verified',
  'CIBIL score',
  'Occupation',
  'City',
  'Status',
  'Rejection reason',
  'Rejection note',
  'Source',
  'Source type',
  'UTM source',
  'UTM medium',
  'UTM campaign',
  'Created',
  'Last modified',
  'Lead UUID',
  'Customer UUID',
] as const;

@Injectable()
export class LosLeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bureauReportPdf: BureauReportPdfService,
    private readonly kycFiles: KycFilesService,
    private readonly cibilCreditAssessment: CibilCreditAssessmentService,
  ) {}

  async listLeads() {
    const leads = await this.prisma.read.lead.findMany({
      where: {
        isActive: true,
        isInternalTesting: false,
        // Handed off to Applications — hide from lead queue once converted with an app row.
        NOT: {
          leadStatus: { name: LEAD_STATUS.CONVERTED },
          applications: { some: {} },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { uuid: true, mobileNumber: true } },
        leadStatus: { select: { name: true, displayName: true } },
        rejectionReason: { select: { name: true } },
        source: { select: { name: true, type: true } },
        leadDetail: {
          select: {
            fullName: true,
            panNumber: true,
            panVerified: true,
            occupation: { select: { name: true } },
            city: { select: { name: true, state: { select: { code: true } } } },
          },
        },
        leadUtms: { select: { utmSource: true, utmMedium: true, utmCampaign: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        bureauReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { cibilScore: true },
        },
        applications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            applicationNumber: true,
            details: { select: { emailId: true } },
          },
        },
      },
    });

    return leads.map((lead) => {
      const latestUtm = lead.leadUtms[0];
      const detail = lead.leadDetail;
      const cityName = detail?.city?.name ?? null;
      const stateCode = detail?.city?.state?.code ?? null;
      const city =
        cityName != null ? (stateCode ? `${cityName}, ${stateCode}` : cityName) : null;
      const cibilScore = lead.bureauReports[0]?.cibilScore ?? null;

      return {
        id: Number(lead.id),
        uuid: lead.uuid,
        leadNumber: lead.leadNumber,
        customerUuid: lead.customer.uuid,
        applicationNumber: lead.applications[0]?.applicationNumber ?? null,
        fullName: formatLosPersonName(detail?.fullName),
        panNumber: detail?.panNumber?.trim().toUpperCase() || null,
        mobileNumber: lead.customer.mobileNumber,
        email: lead.applications[0]?.details?.emailId ?? null,
        occupation: detail?.occupation?.name ?? null,
        city,
        cibilScore,
        panVerified: detail?.panVerified ?? 0,
        panVerifiedLabel: panVerifiedStatusLabel(detail?.panVerified ?? 0),
        rejectionReason: toRejectionReasonDto(lead.rejectionReason),
        leadStatusNote: lead.leadStatusNote?.trim() || null,
        statusCode: lead.leadStatus.name,
        statusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
        sourceName: lead.source?.name ?? null,
        sourceType: lead.source?.type ?? null,
        utmSource: latestUtm?.utmSource ?? null,
        utmMedium: latestUtm?.utmMedium ?? null,
        utmCampaign: latestUtm?.utmCampaign ?? null,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      };
    });
  }

  /** Builds a leads dump workbook for LOS Leads → Download dump. */
  async exportLeadsWorkbook(): Promise<Buffer> {
    const leads = await this.listLeads();
    const rows: SimpleXlsxCell[][] = [
      [...LEAD_DUMP_HEADERS],
      ...leads.map((lead) => [
        lead.leadNumber,
        lead.applicationNumber,
        lead.fullName,
        lead.mobileNumber,
        lead.email,
        lead.panNumber,
        lead.panVerifiedLabel,
        toExcelNumber(lead.cibilScore),
        lead.occupation,
        lead.city,
        lead.statusLabel,
        lead.rejectionReason?.label ?? null,
        lead.leadStatusNote,
        leadSourceLabel(lead),
        lead.sourceType,
        lead.utmSource,
        lead.utmMedium,
        lead.utmCampaign,
        toExcelDate(lead.createdAt),
        toExcelDate(lead.updatedAt),
        lead.uuid,
        lead.customerUuid,
      ]),
    ];
    return buildSimpleXlsxWorkbook(rows, 'Leads');
  }

  async getLeadDetails(leadUuid: string, db: PrismaClient = this.prisma.read) {
    const lead = await db.lead.findUnique({
      where: { uuid: leadUuid },
      include: {
        customer: { select: { uuid: true, mobileNumber: true, createdAt: true } },
        leadStatus: { select: { name: true, displayName: true } },
        source: { select: { name: true, type: true } },
        leadDetail: {
          include: {
            city: { select: { name: true, state: { select: { name: true, code: true } } } },
            gender: { select: { name: true } },
            occupation: { select: { name: true } },
          },
        },
        leadUtms: { orderBy: { createdAt: 'desc' }, take: 1 },
        rejectionReason: { select: { name: true } },
        applications: {
          include: {
            applicationStatus: { select: { name: true, displayName: true } },
            details: { select: { selectedLoanAmount: true, expectedRepaymentDays: true, emailId: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        bureauReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            uuid: true,
            cibilScore: true,
            createdAt: true,
          },
        },
        vendorApiLogs: {
          where: { serviceName: { in: panNsdlServiceNames() } },
          orderBy: [{ respondedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { responsePayload: true },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const latestUtm = lead.leadUtms[0];
    const detail = lead.leadDetail;
    const noteTrimmed = lead.leadStatusNote?.trim() ?? null;
    const bureauNoteTrimmed = detail?.bureauFetchedNote?.trim() ?? null;

    return {
      uuid: lead.uuid,
      leadNumber: lead.leadNumber,
      customerUuid: lead.customer.uuid,
      mobileNumber: lead.customer.mobileNumber,
      email: lead.applications[0]?.details?.emailId ?? null,
      statusCode: lead.leadStatus.name,
      statusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
      panVerified: detail?.panVerified ?? 0,
      panVerifiedLabel: panVerifiedStatusLabel(detail?.panVerified ?? 0),
      panNameMatch: extractNsdlNameMatch(lead.vendorApiLogs[0]?.responsePayload),
      bureauFetched: detail?.bureauFetched ?? 0,
      bureauFetchedLabel: bureauFetchedStatusLabel(detail?.bureauFetched ?? 0),
      leadStatusNote: noteTrimmed,
      bureauFetchedNote: bureauNoteTrimmed,
      rejectionReason: toRejectionReasonDto(lead.rejectionReason),
      sourceName: lead.source?.name ?? null,
      sourceType: lead.source?.type ?? null,
      utm: latestUtm
        ? {
            source: latestUtm.utmSource,
            medium: latestUtm.utmMedium,
            campaign: latestUtm.utmCampaign,
            term: latestUtm.utmTerm,
            content: latestUtm.utmContent,
          }
        : null,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      profile: detail
        ? {
            fullName: formatLosPersonName(detail.fullName),
            dateOfBirth: detail.dateOfBirth ? detail.dateOfBirth.toISOString().slice(0, 10) : null,
            panNumber: detail.panNumber,
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
      bureauReport: lead.bureauReports[0]
        ? {
            uuid: lead.bureauReports[0].uuid,
            cibilScore: lead.bureauReports[0].cibilScore,
            fetchedAt: lead.bureauReports[0].createdAt.toISOString(),
          }
        : null,
      applications: lead.applications.map((application) => ({
        uuid: application.uuid,
        applicationNumber: application.applicationNumber,
        statusCode: application.applicationStatus.name,
        statusLabel: displayName(application.applicationStatus.name, application.applicationStatus.displayName),
        loanAmount: application.details?.selectedLoanAmount?.toString() ?? null,
        loanTenure: application.details?.expectedRepaymentDays ?? null,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
      })),
    };
  }

  async getLeadCibilReport(leadUuid: string) {
    const lead = await this.prisma.read.lead.findUnique({
      where: { uuid: leadUuid },
      select: {
        id: true,
        customer: { select: { uuid: true } },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const bureauReportRow = await this.prisma.read.bureauReport.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        rawPayload: true,
        createdAt: true,
      },
    });

    if (!bureauReportRow) {
      throw new NotFoundException('No bureau report found for this lead');
    }

    if (bureauReportRow.rawPayload == null) {
      throw new NotFoundException('Bureau report has no stored JSON payload');
    }

    const pdfResult = await this.bureauReportPdf.ensurePdfForLead({
      leadId: lead.id,
      customerUuid: lead.customer.uuid,
    });

    const report = await this.bureauReportPdf.buildReportViewData(bureauReportRow.rawPayload);
    const creditAssessment = await this.cibilCreditAssessment.getViewForBureauReportId(
      bureauReportRow.id,
      this.prisma.read,
    );

    return {
      bureauReportUuid: bureauReportRow.uuid,
      fetchedAt: bureauReportRow.createdAt.toISOString(),
      reportPdfUrl: this.resolveBureauReportPdfUrl(leadUuid, pdfResult, true),
      rawPayload: bureauReportRow.rawPayload,
      report,
      creditAssessment,
    };
  }

  async serveLeadCibilReportPdf(leadUuid: string, res: Response): Promise<void> {
    const lead = await this.prisma.read.lead.findUnique({
      where: { uuid: leadUuid },
      select: {
        id: true,
        customer: { select: { uuid: true } },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const pdfResult = await this.bureauReportPdf.ensurePdfForLead({
      leadId: lead.id,
      customerUuid: lead.customer.uuid,
    });
    if (!pdfResult?.relativePath) {
      throw new NotFoundException('Bureau report PDF is not available for this lead.');
    }

    let buf: Buffer;
    try {
      buf = await this.kycFiles.readBytes(pdfResult.relativePath);
    } catch (err) {
      if (isStorageObjectMissing(err)) {
        throw new NotFoundException('Bureau report PDF file is missing from storage.');
      }
      throw err;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="cibil-summary-report.pdf"');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buf);
  }

  private resolveBureauReportPdfUrl(
    leadUuid: string,
    pdfResult: { relativePath: string; publicUrl: string | null } | null,
    hasBureauReport: boolean,
  ): string | null {
    if (!hasBureauReport) return null;
    if (pdfResult?.publicUrl) return pdfResult.publicUrl;
    return `/leads/${leadUuid}/cibil-report/pdf`;
  }

  async rejectLead(leadUuid: string, input: { rejectionReasonId: number; note?: string | null }) {
    const lead = await this.prisma.client.lead.findUnique({
      where: { uuid: leadUuid },
      select: { id: true, leadStatus: { select: { name: true } } },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const currentStatus = lead.leadStatus.name;
    if (currentStatus === LEAD_STATUS.REJECTED) {
      throw new ConflictException('This lead has already been rejected.');
    }
    if (currentStatus === LEAD_STATUS.CONVERTED) {
      throw new BadRequestException('A converted lead cannot be rejected.');
    }

    const [rejectedStatus, rejectionReason] = await Promise.all([
      this.prisma.client.leadStatus.findUnique({
        where: { name: LEAD_STATUS.REJECTED },
        select: { id: true },
      }),
      this.prisma.client.rejectionReason.findUnique({
        where: { id: input.rejectionReasonId },
        select: { id: true, isActive: true },
      }),
    ]);

    if (!rejectedStatus) {
      throw new NotFoundException('Rejected lead status is not configured.');
    }
    if (!rejectionReason) {
      throw new NotFoundException('Rejection reason not found.');
    }
    if (!rejectionReason.isActive) {
      throw new BadRequestException('Selected rejection reason is inactive.');
    }

    await this.prisma.client.lead.update({
      where: { id: lead.id },
      data: {
        leadStatusId: rejectedStatus.id,
        rejectionReasonId: rejectionReason.id,
        leadStatusNote: input.note?.trim() || null,
      },
    });

    return this.getLeadDetails(leadUuid, this.prisma.client);
  }

  /**
   * Admin-only: open a new NEW lead from a rejected case, copy profile/PAN where safe,
   * and deactivate the rejected lead. Bureau / KYC / bank are not copied.
   * Loan amount/purpose are copied when present; repay date is always recomputed from
   * today (1–15 → this month-end, 16+ → next month-end, plus any LOS due-date override).
   */
  async restartRejectedJourney(leadUuid: string) {
    return this.createRestartedLeadFromRejected({ leadUuid });
  }

  async restartRejectedJourneyFromApplication(applicationUuid: string) {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: { uuid: true, lead: { select: { uuid: true } } },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return this.createRestartedLeadFromRejected({ leadUuid: application.lead.uuid });
  }

  private async createRestartedLeadFromRejected(params: { leadUuid: string }) {
    const source = await this.prisma.client.lead.findUnique({
      where: { uuid: params.leadUuid },
      include: {
        leadStatus: { select: { name: true } },
        rejectionReason: { select: { name: true } },
        leadDetail: true,
        leadUtms: { orderBy: { createdAt: 'desc' }, take: 1 },
        applications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { details: true },
        },
      },
    });
    if (!source) {
      throw new NotFoundException('Lead not found');
    }
    if (source.leadStatus.name !== LEAD_STATUS.REJECTED) {
      throw new BadRequestException('Reapply is only available for rejected leads.');
    }

    if (await customerHasOpenLoan(this.prisma.client, source.customerId)) {
      throw new ConflictException(
        'This customer has an active or overdue loan. Close that loan before reapplying.',
      );
    }

    const otherActive = await this.prisma.client.lead.findFirst({
      where: {
        customerId: source.customerId,
        isActive: true,
        id: { not: source.id },
        leadStatus: { name: { notIn: [LEAD_STATUS.REJECTED, LEAD_STATUS.BLACKLISTED] } },
      },
      include: { leadStatus: { select: { name: true } } },
    });
    if (otherActive) {
      throw new ConflictException(
        `Customer already has an active ${otherActive.leadStatus.name} lead (${otherActive.leadNumber}). Use that journey instead.`,
      );
    }

    const newStatus = await this.prisma.client.leadStatus.findFirst({
      where: { name: LEAD_STATUS.NEW, isActive: true },
      select: { id: true },
    });
    if (!newStatus) {
      throw new InternalServerErrorException('Lead status NEW is missing. Run database seeds.');
    }

    const panRejection =
      source.rejectionReason?.name === REJECTION_REASON.PAN_VERIFICATION_FAILED ||
      source.rejectionReason?.name === REJECTION_REASON.PAN_ALREADY_LINKED_TO_PHONE;
    const detail = source.leadDetail;
    const keepPanVerified =
      !panRejection &&
      detail != null &&
      (detail.panVerified === PAN_VERIFIED.VERIFIED || detail.panVerified === PAN_VERIFIED.API_DISABLED);

    const cloned = await this.prisma.client.$transaction(async (tx) => {
      await tx.lead.updateMany({
        where: { customerId: source.customerId, isActive: true },
        data: { isActive: false },
      });

      const created = await this.insertLeadWithUniqueNumber(tx, {
        customerId: source.customerId,
        leadStatusId: newStatus.id,
        sourceId: source.sourceId,
        isInternalTesting: source.isInternalTesting,
        leadStatusNote: `Reapplied by LOS admin from rejected lead ${source.leadNumber}.`,
      });

      const copiedFields: string[] = [];
      if (detail) {
        const panVerified = keepPanVerified ? detail.panVerified : PAN_VERIFIED.NOT_CHECKED;
        await tx.leadDetail.create({
          data: {
            leadId: created.id,
            fullName: detail.fullName,
            dateOfBirth: detail.dateOfBirth,
            genderId: detail.genderId,
            cityId: detail.cityId,
            pincode: detail.pincode,
            addressLine1: detail.addressLine1,
            addressLine2: detail.addressLine2,
            occupationId: detail.occupationId,
            netMonthlyIncome: detail.netMonthlyIncome,
            annualTurnover: detail.annualTurnover,
            annualProfit: detail.annualProfit,
            cibilConsentAt: detail.cibilConsentAt,
            panNumber: detail.panNumber,
            panVerified,
            panVerifiedAt: keepPanVerified ? detail.panVerifiedAt : null,
            panValidationAttempts: 0,
            bureauFetched: BUREAU_FETCHED.NOT_FETCHED,
            bureauFetchedAt: null,
            bureauFetchedNote: null,
          },
        });
        if (detail.fullName?.trim()) copiedFields.push('name');
        if (detail.dateOfBirth) copiedFields.push('date of birth');
        if (detail.genderId) copiedFields.push('gender');
        if (detail.cityId || detail.pincode || detail.addressLine1) copiedFields.push('address');
        if (detail.occupationId) copiedFields.push('occupation');
        if (detail.netMonthlyIncome != null || detail.annualTurnover != null) copiedFields.push('income');
        if (detail.panNumber) copiedFields.push(keepPanVerified ? 'verified PAN' : 'PAN number');
        if (detail.cibilConsentAt) copiedFields.push('bureau consent');
      }

      const utm = source.leadUtms[0];
      if (utm) {
        await tx.leadUtm.create({
          data: {
            leadId: created.id,
            utmSource: utm.utmSource,
            utmMedium: utm.utmMedium,
            utmCampaign: utm.utmCampaign,
            utmTerm: utm.utmTerm,
            utmContent: utm.utmContent,
          },
        });
        copiedFields.push('UTM');
      }

      const sourceDetails = source.applications[0]?.details;
      if (sourceDetails?.selectedLoanAmount != null && sourceDetails.reasonForLoanId != null) {
        const tenureEndDate = await resolveRepaymentDueDateUtc(tx);
        const tenureDays = computeTenureDays(istCalendarDateUtc(), tenureEndDate);
        const draftStatus = tenureDays <= 62
          ? await tx.applicationStatus.findFirst({
              where: { name: APPLICATION_STATUS.DRAFT, isActive: true },
              select: { id: true },
            })
          : null;
        if (draftStatus) {
          const application = await tx.application.create({
            data: {
              customerId: source.customerId,
              leadId: created.id,
              applicationStatusId: draftStatus.id,
              applicationNumber: created.leadNumber,
            },
          });
          await tx.applicationDetail.create({
            data: {
              applicationId: application.id,
              selectedLoanAmount: sourceDetails.selectedLoanAmount,
              interestRate: sourceDetails.interestRate,
              processingFeePercentage: sourceDetails.processingFeePercentage,
              gstPercentage: sourceDetails.gstPercentage,
              reasonForLoanId: sourceDetails.reasonForLoanId,
              expectedRepaymentDays: tenureDays,
              expectedRepaymentDate: tenureEndDate,
            },
          });
          copiedFields.push('loan amount', 'repay date');
        }
      }

      return { created, copiedFields };
    });

    return {
      success: true as const,
      sourceLeadUuid: source.uuid,
      sourceLeadNumber: source.leadNumber,
      newLeadUuid: cloned.created.uuid,
      newLeadNumber: cloned.created.leadNumber,
      copiedFields: cloned.copiedFields,
    };
  }

  private async insertLeadWithUniqueNumber(
    tx: Prisma.TransactionClient,
    data: {
      customerId: bigint;
      leadStatusId: number;
      sourceId: number | null;
      isInternalTesting: boolean;
      leadStatusNote: string;
    },
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await tx.lead.create({
          data: {
            customerId: data.customerId,
            leadStatusId: data.leadStatusId,
            leadNumber: generateLeadNumber(),
            sourceId: data.sourceId,
            isInternalTesting: data.isInternalTesting,
            leadStatusNote: data.leadStatusNote,
            isActive: true,
          },
        });
      } catch (err) {
        lastError = err;
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          continue;
        }
        throw err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new InternalServerErrorException('Failed to allocate a unique lead id.');
  }

  async markInternalTesting(leadUuid: string): Promise<{ success: true; leadUuid: string }> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { uuid: leadUuid },
      select: { id: true, uuid: true, isInternalTesting: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    if (!lead.isInternalTesting) {
      await this.prisma.client.lead.update({
        where: { id: lead.id },
        data: { isInternalTesting: true },
      });
    }
    return { success: true, leadUuid: lead.uuid };
  }
}

function isStorageObjectMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('NoSuchKey') || msg.includes('S3 GET failed (404)') || msg.includes('S3 HEAD failed (404)');
}
