import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { BUREAU_FETCHED } from '../../../common/constants/bureau-fetch.constants';
import { LEAD_STATUS } from '../../../common/constants/lead.constants';
import { PAN_VERIFIED } from '../../../common/constants/pan-verification.constants';
import { BureauReportPdfService } from '../../../common/cibil/bureau-report-pdf.service';
import { CibilCreditAssessmentService } from '../../../common/cibil/cibil-credit-assessment.service';
import { KycFilesService } from '../../../common/kyc/kyc-files.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatLosPersonName } from '../format-los-person-name';
import { buildSimpleXlsxWorkbook, type SimpleXlsxCell } from '../../../common/xlsx/simple-xlsx';

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
    const leads = await this.prisma.client.lead.findMany({
      where: {
        isActive: true,
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
      take: 500,
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
        rejectionReason: lead.rejectionReason
          ? {
              code: lead.rejectionReason.name,
              label: lead.rejectionReason.name.replace(/_/g, ' '),
            }
          : null,
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
        lead.id,
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

  async getLeadDetails(leadUuid: string) {
    const lead = await this.prisma.client.lead.findUnique({
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
            htmlUrl: true,
            createdAt: true,
          },
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
      customerUuid: lead.customer.uuid,
      mobileNumber: lead.customer.mobileNumber,
      email: lead.applications[0]?.details?.emailId ?? null,
      statusCode: lead.leadStatus.name,
      statusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
      panVerified: detail?.panVerified ?? 0,
      panVerifiedLabel: panVerifiedStatusLabel(detail?.panVerified ?? 0),
      bureauFetched: detail?.bureauFetched ?? 0,
      bureauFetchedLabel: bureauFetchedStatusLabel(detail?.bureauFetched ?? 0),
      leadStatusNote: noteTrimmed,
      bureauFetchedNote: bureauNoteTrimmed,
      rejectionReason: lead.rejectionReason
        ? {
            code: lead.rejectionReason.name,
            label: lead.rejectionReason.name.replace(/_/g, ' '),
          }
        : null,
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
            htmlUrl: lead.bureauReports[0].htmlUrl,
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
    const lead = await this.prisma.client.lead.findUnique({
      where: { uuid: leadUuid },
      select: {
        id: true,
        customer: { select: { uuid: true } },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const bureauReportRow = await this.prisma.client.bureauReport.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        htmlUrl: true,
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
    const creditAssessment = await this.cibilCreditAssessment.getViewForBureauReportId(bureauReportRow.id);

    return {
      bureauReportUuid: bureauReportRow.uuid,
      fetchedAt: bureauReportRow.createdAt.toISOString(),
      reportPdfUrl: this.resolveBureauReportPdfUrl(leadUuid, pdfResult, true),
      htmlUrl: bureauReportRow.htmlUrl,
      rawPayload: bureauReportRow.rawPayload,
      report,
      creditAssessment,
    };
  }

  async serveLeadCibilReportPdf(leadUuid: string, res: Response): Promise<void> {
    const lead = await this.prisma.client.lead.findUnique({
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

    return this.getLeadDetails(leadUuid);
  }
}

function isStorageObjectMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('NoSuchKey') || msg.includes('S3 GET failed (404)') || msg.includes('S3 HEAD failed (404)');
}
