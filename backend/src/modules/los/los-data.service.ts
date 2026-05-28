import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { LeadSourceType, Prisma } from '@prisma/client';
import { APPLICATION_STATUS } from '../../common/constants/application.constants';
import { LEAD_STATUS } from '../../common/constants/lead.constants';
import { PAN_VERIFIED } from '../../common/constants/pan-verification.constants';
import { BureauReportPdfService } from '../../common/cibil/bureau-report-pdf.service';
import { KycFilesService } from '../../common/kyc/kyc-files.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateNegativeCityDto } from './dto/create-negative-city.dto';
import type { CreateNegativePincodeDto } from './dto/create-negative-pincode.dto';
import type { CreateNegativeStateDto } from './dto/create-negative-state.dto';
import type { UpdateLeadSourceMasterDto } from './dto/update-lead-source-master.dto';
import type { UpdateUtmCampaignDto } from './dto/update-utm-campaign.dto';
import type { UpdateUtmMediumDto } from './dto/update-utm-medium.dto';
import type { UpdateUtmSourceDto } from './dto/update-utm-source.dto';
import type { UpdateBankMasterDto } from './dto/update-bank-master.dto';
import type { UpdateEligibilityCriterionDto } from './dto/update-eligibility-criterion.dto';
import type { UpdateCreditLimitTierDto } from './dto/update-credit-limit-tier.dto';

type LosAuditUser = { id: string; fullName: string; email: string } | null;

const negativeListUserSelect = {
  id: true,
  fullName: true,
  email: true,
} as const;

const negativePincodeInclude = {
  addedBy: { select: negativeListUserSelect },
  removedBy: { select: negativeListUserSelect },
} as const;

const negativeCityInclude = {
  city: { include: { state: true } },
  addedBy: { select: negativeListUserSelect },
  removedBy: { select: negativeListUserSelect },
} as const;

const negativeStateInclude = {
  state: true,
  addedBy: { select: negativeListUserSelect },
  removedBy: { select: negativeListUserSelect },
} as const;

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

const DASHBOARD_DAILY_TREND_DAYS = 14;

/** UTC calendar day key `YYYY-MM-DD` from a SQL `DATE` / `Date` / ISO string. */
function dashboardRowDayKey(d: Date | string): string {
  if (typeof d === 'string') {
    return d.length >= 10 ? d.slice(0, 10) : d;
  }
  return d.toISOString().slice(0, 10);
}

/** Last `DASHBOARD_DAILY_TREND_DAYS` UTC dates oldest → newest. */
function lastUtcDayKeys(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

/** Inclusive UTC start and exclusive end for a `YYYY-MM-DD` day key. */
function utcDayBounds(dayKey: string): { gte: Date; lt: Date } {
  const gte = new Date(`${dayKey}T00:00:00.000Z`);
  const lt = new Date(gte.getTime() + 86_400_000);
  return { gte, lt };
}

/** Count timestamps into fixed UTC day keys (ignores dates outside `dayKeys`). */
function countByUtcDayKeys(dayKeys: string[], dates: Date[]): Map<string, number> {
  const keySet = new Set(dayKeys);
  const counts = new Map<string, number>();
  for (const key of dayKeys) {
    counts.set(key, 0);
  }
  for (const dt of dates) {
    const k = dashboardRowDayKey(dt);
    if (!keySet.has(k)) {
      continue;
    }
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

function sumDisbursementsByUtcDayKeys(
  dayKeys: string[],
  rows: Array<{ disbursedAt: Date | null; amount: Prisma.Decimal | null }>,
): Map<string, { count: number; amount: Prisma.Decimal }> {
  const keySet = new Set(dayKeys);
  const agg = new Map<string, { count: number; amount: Prisma.Decimal }>();
  for (const key of dayKeys) {
    agg.set(key, { count: 0, amount: new Prisma.Decimal(0) });
  }
  for (const row of rows) {
    if (!row.disbursedAt) {
      continue;
    }
    const k = dashboardRowDayKey(row.disbursedAt);
    if (!keySet.has(k)) {
      continue;
    }
    const cur = agg.get(k)!;
    cur.count += 1;
    if (row.amount != null) {
      cur.amount = cur.amount.add(row.amount);
    }
  }
  return agg;
}

type LosUtmMasterRow = {
  id: number;
  leadSourceId: number;
  name: string;
  isActive: boolean;
  leadSource: { name: string };
};

type LosDashboardDailyPoint = {
  date: string;
  newLeads: number;
  newApplications: number;
  disbursedCount: number;
  disbursedAmountInr: string | null;
};

function mergeLosDashboardDailySeries(
  keys: string[],
  leadRows: Array<{ d: Date | string; c: bigint }>,
  appRows: Array<{ d: Date | string; c: bigint }>,
  disbRows: Array<{ d: Date | string; c: bigint; amt: unknown }>,
): LosDashboardDailyPoint[] {
  const leadMap = new Map<string, number>();
  const appMap = new Map<string, number>();
  const disbMap = new Map<string, { count: number; amount: string | null }>();
  for (const r of leadRows) {
    leadMap.set(dashboardRowDayKey(r.d), Number(r.c));
  }
  for (const r of appRows) {
    appMap.set(dashboardRowDayKey(r.d), Number(r.c));
  }
  for (const r of disbRows) {
    const k = dashboardRowDayKey(r.d);
    const raw = r.amt;
    const amount = raw === null || raw === undefined ? null : String(raw);
    disbMap.set(k, { count: Number(r.c), amount });
  }
  return keys.map((date) => {
    const dis = disbMap.get(date);
    return {
      date,
      newLeads: leadMap.get(date) ?? 0,
      newApplications: appMap.get(date) ?? 0,
      disbursedCount: dis?.count ?? 0,
      disbursedAmountInr: dis?.amount ?? null,
    };
  });
}

@Injectable()
export class LosDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bureauReportPdf: BureauReportPdfService,
    private readonly kycFiles: KycFilesService,
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
            email: true,
            eligibility: { select: { cibilScore: true } },
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
      const cibilScore =
        lead.bureauReports[0]?.cibilScore ?? lead.applications[0]?.eligibility?.cibilScore ?? null;

      return {
        uuid: lead.uuid,
        customerUuid: lead.customer.uuid,
        fullName: detail?.fullName?.trim() || null,
        panNumber: lead.panNumber?.trim().toUpperCase() || null,
        mobileNumber: lead.customer.mobileNumber,
        email: lead.applications[0]?.email ?? null,
        occupation: detail?.occupation?.name ?? null,
        city,
        cibilScore,
        panVerified: lead.panVerified,
        panVerifiedLabel: panVerifiedStatusLabel(lead.panVerified),
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
        fullName: application.lead.leadDetail?.fullName ?? null,
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
            details: { select: { loanAmount: true, loanTenure: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const latestUtm = lead.leadUtms[0];
    const detail = lead.leadDetail;
    const noteTrimmed = lead.leadStatusNote?.trim() ?? null;
    const bureauNoteTrimmed = lead.bureauFetchedNote?.trim() ?? null;

    return {
      uuid: lead.uuid,
      customerUuid: lead.customer.uuid,
      mobileNumber: lead.customer.mobileNumber,
      email: lead.applications[0]?.email ?? null,
      statusCode: lead.leadStatus.name,
      statusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
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
            fullName: detail.fullName,
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
      applications: lead.applications.map((application) => ({
        uuid: application.uuid,
        statusCode: application.applicationStatus.name,
        statusLabel: displayName(application.applicationStatus.name, application.applicationStatus.displayName),
        loanAmount: application.details?.loanAmount?.toString() ?? null,
        loanTenure: application.details?.loanTenure ?? null,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
      })),
    };
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
        selfieUrl: application.selfieRelativePath?.trim()
          ? `/applications/${application.uuid}/kyc/selfie-photo`
          : null,
        aadhaarPhotoUrl: application.aadhaarPhotoRelativePath?.trim()
          ? `/applications/${application.uuid}/kyc/aadhaar-photo`
          : null,
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
        profile: detail
          ? {
              fullName: detail.fullName,
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
      details: application.details
        ? {
            reasonForLoan: application.details.reasonForLoan?.name ?? null,
            loanAmount: application.details.loanAmount?.toString() ?? null,
            loanTenure: application.details.loanTenure,
            interestRate: application.details.interestRate?.toString() ?? null,
            interestAmount: application.details.interestAmount?.toString() ?? null,
            processingFee: application.details.processingFee?.toString() ?? null,
            processingFeeAmount: application.details.processingFeeAmount?.toString() ?? null,
            gstAmount: application.details.gstAmount?.toString() ?? null,
            loanDisbursementDate: application.details.loanDisbursementDate?.toISOString().slice(0, 10) ?? null,
            loanMaturityDate: application.details.loanMaturityDate?.toISOString().slice(0, 10) ?? null,
          }
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

  private async streamKycPhoto(relativePath: string, res: Response): Promise<void> {
    const buf = await this.kycFiles.readBytes(relativePath);
    const lower = relativePath.toLowerCase();
    const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=60');
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

  async getMasters() {
    const utmQueryBase = {
      include: { leadSource: { select: { name: true } } },
      orderBy: [{ leadSource: { name: 'asc' as const } }, { name: 'asc' as const }],
    };
    const prismaAny = this.prisma.client as any;

    const [
      leadStatuses,
      applicationStatuses,
      leadSources,
      states,
      cities,
      occupations,
      reasonsForLoan,
      genders,
      banks,
      rejectionReasons,
      utmSources,
      utmMediums,
      utmCampaigns,
    ] = await Promise.all([
      this.prisma.client.leadStatus.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.client.applicationStatus.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.client.leadSource.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.state.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.city.findMany({ include: { state: true }, orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }] }),
      this.prisma.client.occupation.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.reasonForLoan.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.gender.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.bank.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.rejectionReason.findMany({ orderBy: { name: 'asc' } }),
      prismaAny.sourceUtm.findMany({ ...utmQueryBase, where: { type: 'SOURCE' } }),
      prismaAny.sourceUtm.findMany({ ...utmQueryBase, where: { type: 'MEDIUM' } }),
      prismaAny.sourceUtm.findMany({ ...utmQueryBase, where: { type: 'CAMPAIGN' } }),
    ]);

    return {
      leadStatuses: leadStatuses.map((item) => ({
        id: item.id,
        code: item.name,
        displayName: displayName(item.name, item.displayName),
        customDisplayName: item.displayName,
        isActive: item.isActive,
      })),
      applicationStatuses: applicationStatuses.map((item) => ({
        id: item.id,
        code: item.name,
        displayName: displayName(item.name, item.displayName),
        customDisplayName: item.displayName,
        isActive: item.isActive,
      })),
      leadSources: leadSources.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        isActive: item.isActive,
      })),
      states: states.map((item) => ({
        id: item.id,
        name: item.name,
        code: item.code,
        isActive: item.isActive,
      })),
      cities: cities.map((item) => ({
        id: item.id,
        name: item.name,
        stateId: item.stateId,
        stateName: item.state.name,
        stateCode: item.state.code,
        stateIsActive: item.state.isActive,
        isActive: item.isActive,
      })),
      occupations: occupations.map((item) => ({
        id: item.id,
        name: item.name,
        isActive: item.isActive,
      })),
      reasonsForLoan: reasonsForLoan.map((item) => ({
        id: item.id,
        name: item.name,
        isActive: item.isActive,
      })),
      genders: genders.map((item) => ({
        id: item.id,
        name: item.name,
        isActive: item.isActive,
      })),
      banks: banks.map((item) => ({
        id: item.id,
        name: item.name,
        isActive: item.isActive,
      })),
      rejectionReasons: rejectionReasons.map((item) => ({
        id: item.id,
        name: item.name,
        isActive: item.isActive,
      })),
      utmSources: (utmSources as LosUtmMasterRow[]).map((item: LosUtmMasterRow) => this.mapUtmTag(item)),
      utmMediums: (utmMediums as LosUtmMasterRow[]).map((item: LosUtmMasterRow) => this.mapUtmTag(item)),
      utmCampaigns: (utmCampaigns as LosUtmMasterRow[]).map((item: LosUtmMasterRow) => this.mapUtmTag(item)),
    };
  }

  private mapBank(item: { id: number; name: string; isActive: boolean }) {
    return { id: item.id, name: item.name, isActive: item.isActive };
  }

  private mapLeadSource(item: { id: number; name: string; type: string; isActive: boolean }) {
    return { id: item.id, name: item.name, type: item.type, isActive: item.isActive };
  }

  private mapUtmTag(item: {
    id: number;
    leadSourceId: number;
    name: string;
    isActive: boolean;
    leadSource: { name: string };
  }) {
    return {
      id: item.id,
      leadSourceId: item.leadSourceId,
      leadSourceName: item.leadSource.name,
      name: item.name,
      isActive: item.isActive,
    };
  }

  private async assertLeadSourceExists(leadSourceId: number) {
    const row = await this.prisma.client.leadSource.findUnique({
      where: { id: leadSourceId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Lead source not found');
    }
  }

  async createBank(name: string) {
    try {
      const row = await this.prisma.client.bank.create({
        data: { name, isActive: true },
      });
      return this.mapBank(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A bank with this name already exists.');
      }
      throw error;
    }
  }

  async updateBank(id: number, dto: UpdateBankMasterDto) {
    const hasName = dto.name !== undefined;
    const hasActive = dto.isActive !== undefined;
    if (!hasName && !hasActive) {
      throw new BadRequestException('Provide name and/or isActive to update.');
    }

    const existing = await this.prisma.client.bank.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Bank not found');
    }

    const data: { name?: string; isActive?: boolean } = {};
    if (hasName) {
      const trimmed = dto.name!.trim();
      if (!trimmed) {
        throw new BadRequestException('Bank name cannot be empty.');
      }
      data.name = trimmed;
    }
    if (hasActive) {
      data.isActive = dto.isActive;
    }

    try {
      const row = await this.prisma.client.bank.update({
        where: { id },
        data,
      });
      return this.mapBank(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A bank with this name already exists.');
      }
      throw error;
    }
  }

  async deleteBank(id: number) {
    const existing = await this.prisma.client.bank.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Bank not found');
    }

    await this.prisma.client.bank.delete({ where: { id } });
    return { ok: true as const };
  }

  async createLeadSource(input: { name: string; type: LeadSourceType }) {
    try {
      const row = await this.prisma.client.leadSource.create({
        data: { name: input.name, type: input.type, isActive: true },
      });
      return this.mapLeadSource(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A lead source with this name already exists.');
      }
      throw error;
    }
  }

  async updateLeadSource(id: number, dto: UpdateLeadSourceMasterDto) {
    const hasName = dto.name !== undefined;
    const hasType = dto.type !== undefined;
    const hasActive = dto.isActive !== undefined;
    if (!hasName && !hasType && !hasActive) {
      throw new BadRequestException('Provide name, type, and/or isActive to update.');
    }

    const existing = await this.prisma.client.leadSource.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Lead source not found');
    }

    const data: { name?: string; type?: LeadSourceType; isActive?: boolean } = {};
    if (hasName) {
      const trimmed = dto.name!.trim();
      if (!trimmed) {
        throw new BadRequestException('Lead source name cannot be empty.');
      }
      data.name = trimmed;
    }
    if (hasType) {
      data.type = dto.type;
    }
    if (hasActive) {
      data.isActive = dto.isActive;
    }

    try {
      const row = await this.prisma.client.leadSource.update({
        where: { id },
        data,
      });
      return this.mapLeadSource(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A lead source with this name already exists.');
      }
      throw error;
    }
  }

  async createUtmSource(input: { leadSourceId: number; name: string }) {
    await this.assertLeadSourceExists(input.leadSourceId);
    try {
      const row = await (this.prisma.client as any).sourceUtm.create({
        data: { leadSourceId: input.leadSourceId, type: 'SOURCE', name: input.name, isActive: true },
        include: { leadSource: { select: { name: true } } },
      });
      return this.mapUtmTag(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This UTM source already exists for the selected lead source.');
      }
      throw error;
    }
  }

  async updateUtmSource(id: number, dto: UpdateUtmSourceDto) {
    return this.updateUtmTagRow(id, dto, 'UTM source', 'SOURCE');
  }

  async createUtmMedium(input: { leadSourceId: number; name: string }) {
    await this.assertLeadSourceExists(input.leadSourceId);
    try {
      const row = await (this.prisma.client as any).sourceUtm.create({
        data: { leadSourceId: input.leadSourceId, type: 'MEDIUM', name: input.name, isActive: true },
        include: { leadSource: { select: { name: true } } },
      });
      return this.mapUtmTag(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This UTM medium already exists for the selected lead source.');
      }
      throw error;
    }
  }

  async updateUtmMedium(id: number, dto: UpdateUtmMediumDto) {
    return this.updateUtmTagRow(id, dto, 'UTM medium', 'MEDIUM');
  }

  async createUtmCampaign(input: { leadSourceId: number; name: string }) {
    await this.assertLeadSourceExists(input.leadSourceId);
    try {
      const row = await (this.prisma.client as any).sourceUtm.create({
        data: { leadSourceId: input.leadSourceId, type: 'CAMPAIGN', name: input.name, isActive: true },
        include: { leadSource: { select: { name: true } } },
      });
      return this.mapUtmTag(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This UTM campaign already exists for the selected lead source.');
      }
      throw error;
    }
  }

  async updateUtmCampaign(id: number, dto: UpdateUtmCampaignDto) {
    return this.updateUtmTagRow(id, dto, 'UTM campaign', 'CAMPAIGN');
  }

  private async updateUtmTagRow(
    id: number,
    dto: { name?: string; isActive?: boolean },
    label: string,
    type: 'SOURCE' | 'MEDIUM' | 'CAMPAIGN',
  ) {
    const hasName = dto.name !== undefined;
    const hasActive = dto.isActive !== undefined;
    if (!hasName && !hasActive) {
      throw new BadRequestException('Provide name and/or isActive to update.');
    }

    const client = this.prisma.client as any;
    const existing = await client.sourceUtm.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`${label} not found`);
    }
    if (existing.type !== type) {
      throw new BadRequestException(`${label} does not match requested UTM type.`);
    }

    const data: { name?: string; isActive?: boolean } = {};
    if (hasName) {
      const trimmed = dto.name!.trim();
      if (!trimmed) {
        throw new BadRequestException(`${label} name cannot be empty.`);
      }
      data.name = trimmed;
    }
    if (hasActive) {
      data.isActive = dto.isActive;
    }

    try {
      const row = await client.sourceUtm.update({
        where: { id },
        data,
        include: { leadSource: { select: { name: true } } },
      });
      return this.mapUtmTag(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`This ${label.toLowerCase()} already exists for the selected lead source.`);
      }
      throw error;
    }
  }

  async getEligibilityCriteriaForLos() {
    const rows = await this.prisma.client.eligibilityCriteria.findMany({
      orderBy: { id: 'asc' },
    });

    const eligibilityCriteria = rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      value: row.value,
      description: row.description,
      isActive: row.isActive,
    }));

    return { eligibilityCriteria };
  }

  async updateEligibilityCriterion(id: number, dto: UpdateEligibilityCriterionDto) {
    const hasValue = dto.value !== undefined;
    const hasActive = dto.isActive !== undefined;
    if (!hasValue && !hasActive) {
      throw new BadRequestException('Provide value and/or isActive to update.');
    }

    const existing = await this.prisma.client.eligibilityCriteria.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Eligibility criterion not found');
    }

    const data: { value?: string; isActive?: boolean } = {};
    if (hasValue) {
      const trimmed = dto.value!.trim();
      if (!trimmed) {
        throw new BadRequestException('Value cannot be empty.');
      }
      data.value = trimmed;
    }
    if (hasActive) {
      data.isActive = dto.isActive;
    }

    const row = await this.prisma.client.eligibilityCriteria.update({
      where: { id },
      data,
    });

    return {
      id: row.id,
      key: row.key,
      label: row.label,
      value: row.value,
      description: row.description,
      isActive: row.isActive,
    };
  }

  async getCreditLimitTiersForLos() {
    const rows = await this.prisma.client.creditLimitTier.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    const creditLimitTiers = rows.map((row) => ({
      id: row.id,
      minUnsecuredLoan: row.minUnsecuredLoan,
      maxUnsecuredLoan: row.maxUnsecuredLoan,
      maxBulletLoan: row.maxBulletLoan,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    }));

    return { creditLimitTiers };
  }

  async updateCreditLimitTier(id: number, dto: UpdateCreditLimitTierDto) {
    const hasMin = dto.minUnsecuredLoan !== undefined;
    const hasMax = dto.maxUnsecuredLoan !== undefined;
    const hasBullet = dto.maxBulletLoan !== undefined;
    const hasSort = dto.sortOrder !== undefined;
    const hasActive = dto.isActive !== undefined;

    if (!hasMin && !hasMax && !hasBullet && !hasSort && !hasActive) {
      throw new BadRequestException(
        'Provide minUnsecuredLoan, maxUnsecuredLoan, maxBulletLoan, sortOrder, and/or isActive to update.',
      );
    }

    const existing = await this.prisma.client.creditLimitTier.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Credit limit tier not found');
    }

    const nextMin = hasMin ? dto.minUnsecuredLoan! : existing.minUnsecuredLoan;
    const nextMax = hasMax ? dto.maxUnsecuredLoan! : existing.maxUnsecuredLoan;
    const nextBullet = hasBullet ? dto.maxBulletLoan! : existing.maxBulletLoan;
    const nextSort = hasSort ? dto.sortOrder! : existing.sortOrder;

    if (nextMax != null && nextMax < nextMin) {
      throw new BadRequestException('maxUnsecuredLoan cannot be less than minUnsecuredLoan.');
    }

    const row = await this.prisma.client.creditLimitTier.update({
      where: { id },
      data: {
        ...(hasMin ? { minUnsecuredLoan: nextMin } : {}),
        ...(hasMax ? { maxUnsecuredLoan: nextMax } : {}),
        ...(hasBullet ? { maxBulletLoan: nextBullet } : {}),
        ...(hasSort ? { sortOrder: nextSort } : {}),
        ...(hasActive ? { isActive: dto.isActive } : {}),
      },
    });

    return {
      id: row.id,
      minUnsecuredLoan: row.minUnsecuredLoan,
      maxUnsecuredLoan: row.maxUnsecuredLoan,
      maxBulletLoan: row.maxBulletLoan,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    };
  }

  private async fetchDashboardDailyTrends(
    dayKeys: string[],
  ): Promise<{
    leadRows: Array<{ d: Date; c: bigint }>;
    appRows: Array<{ d: Date; c: bigint }>;
    disbRows: Array<{ d: Date; c: bigint; amt: unknown }>;
  }> {
    if (dayKeys.length === 0) {
      return { leadRows: [], appRows: [], disbRows: [] };
    }

    const prisma = this.prisma.client;
    const { gte: seriesSince } = utcDayBounds(dayKeys[0]!);
    const { lt: seriesUntil } = utcDayBounds(dayKeys[dayKeys.length - 1]!);

    const [leads, applications, disbursements] = await Promise.all([
      prisma.lead.findMany({
        where: { createdAt: { gte: seriesSince, lt: seriesUntil } },
        select: { createdAt: true },
      }),
      prisma.application.findMany({
        where: { createdAt: { gte: seriesSince, lt: seriesUntil } },
        select: { createdAt: true },
      }),
      prisma.applicationDisbursement.findMany({
        where: { disbursedAt: { gte: seriesSince, lt: seriesUntil } },
        select: { disbursedAt: true, amount: true },
      }),
    ]);

    const leadCounts = countByUtcDayKeys(
      dayKeys,
      leads.map((row) => row.createdAt),
    );
    const appCounts = countByUtcDayKeys(
      dayKeys,
      applications.map((row) => row.createdAt),
    );
    const disbAgg = sumDisbursementsByUtcDayKeys(dayKeys, disbursements);

    return {
      leadRows: dayKeys.map((key) => ({
        d: utcDayBounds(key).gte,
        c: BigInt(leadCounts.get(key) ?? 0),
      })),
      appRows: dayKeys.map((key) => ({
        d: utcDayBounds(key).gte,
        c: BigInt(appCounts.get(key) ?? 0),
      })),
      disbRows: dayKeys.map((key) => {
        const v = disbAgg.get(key)!;
        return { d: utcDayBounds(key).gte, c: BigInt(v.count), amt: v.amount };
      }),
    };
  }

  /** Aggregated LOS CRM dashboard (counts + small activity feed). */
  async getDashboardCrm() {
    const prisma = this.prisma.client;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const dayKeys = lastUtcDayKeys(DASHBOARD_DAILY_TREND_DAYS);

    const [
      activeAgentsToday,
      customerCount,
      leadGroups,
      applicationGroups,
      newApplicationsToday,
      newLeadsToday,
      disbursedTodayAgg,
      sanctionedPipelineAgg,
      avgLoanAgg,
      kycPendingInFlow,
      livenessPending,
      recentApplications,
      leadStatuses,
      applicationStatuses,
      dailyTrends,
    ] = await Promise.all([
      prisma.user.count({
        where: {
          isActive: true,
          password: { not: null },
          lastLoginAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      prisma.customer.count(),
      prisma.lead.groupBy({
        by: ['leadStatusId'],
        where: { isActive: true },
        _count: { _all: true },
      }),
      prisma.application.groupBy({
        by: ['applicationStatusId'],
        _count: { _all: true },
      }),
      prisma.application.count({
        where: { createdAt: { gte: startOfDay, lt: endOfDay } },
      }),
      prisma.lead.count({
        where: { isActive: true, createdAt: { gte: startOfDay, lt: endOfDay } },
      }),
      prisma.applicationDisbursement.aggregate({
        where: { disbursedAt: { gte: startOfDay, lt: endOfDay } },
        _sum: { amount: true },
      }),
      prisma.applicationEligibility.aggregate({
        where: {
          application: {
            applicationStatus: { name: APPLICATION_STATUS.APPROVED },
          },
        },
        _sum: { approvedAmount: true },
      }),
      prisma.applicationDetails.aggregate({
        where: { loanAmount: { not: null } },
        _avg: { loanAmount: true },
      }),
      prisma.application.count({
        where: {
          kycStatus: 0,
          applicationStatus: { name: { in: [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.IN_REVIEW] } },
        },
      }),
      prisma.application.count({
        where: {
          kycStatus: 1,
          livenessPassed: false,
          applicationStatus: { name: { in: [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.IN_REVIEW] } },
        },
      }),
      prisma.application.findMany({
        take: 8,
        orderBy: { updatedAt: 'desc' },
        select: {
          uuid: true,
          updatedAt: true,
          kycStatus: true,
          livenessPassed: true,
          applicationStatus: { select: { name: true, displayName: true } },
          lead: { select: { leadDetail: { select: { fullName: true } } } },
          customer: { select: { mobileNumber: true } },
        },
      }),
      prisma.leadStatus.findMany({ select: { id: true, name: true, displayName: true } }),
      prisma.applicationStatus.findMany({ select: { id: true, name: true, displayName: true } }),
      this.fetchDashboardDailyTrends(dayKeys),
    ]);

    const { leadRows: leadDailyRows, appRows: appDailyRows, disbRows: disbDailyRows } = dailyTrends;

    const leadStatusById = new Map(leadStatuses.map((s) => [s.id, s]));
    const applicationStatusById = new Map(applicationStatuses.map((s) => [s.id, s]));

    const leadsByStatus = leadGroups.map((g) => {
      const s = leadStatusById.get(g.leadStatusId);
      return {
        code: s?.name ?? String(g.leadStatusId),
        label: displayName(s?.name ?? 'UNKNOWN', s?.displayName ?? null),
        count: g._count._all,
      };
    });

    const applicationsByStatus = applicationGroups.map((g) => {
      const s = applicationStatusById.get(g.applicationStatusId);
      return {
        code: s?.name ?? String(g.applicationStatusId),
        label: displayName(s?.name ?? 'UNKNOWN', s?.displayName ?? null),
        count: g._count._all,
      };
    });

    const countByLeadCode = (codes: readonly string[]) =>
      leadsByStatus.filter((row) => codes.includes(row.code)).reduce((a, b) => a + b.count, 0);

    const countByAppCode = (codes: readonly string[]) =>
      applicationsByStatus.filter((row) => codes.includes(row.code)).reduce((a, b) => a + b.count, 0);

    const freshLeads = countByLeadCode([LEAD_STATUS.NEW, LEAD_STATUS.IN_PROGRESS]);
    const applicationInProgress = countByAppCode([APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.IN_REVIEW]);
    const approvedCount = countByAppCode([APPLICATION_STATUS.APPROVED]);
    const disbursedCount = countByAppCode([APPLICATION_STATUS.DISBURSED]);
    const rejectedAppCount = countByAppCode([APPLICATION_STATUS.REJECTED]);
    const decided = approvedCount + rejectedAppCount;
    const approvalRatePercent = decided > 0 ? Math.round((approvedCount / decided) * 100) : null;

    const recentActivity = recentApplications.map((app) => {
      const name = app.lead.leadDetail?.fullName?.trim() || 'Borrower';
      const mobile = app.customer.mobileNumber;
      const tail = mobile.length >= 4 ? mobile.slice(-4) : mobile;
      const statusLabel = displayName(app.applicationStatus.name, app.applicationStatus.displayName);
      const title =
        app.applicationStatus.name === APPLICATION_STATUS.DISBURSED
          ? 'Disbursement recorded'
          : app.applicationStatus.name === APPLICATION_STATUS.APPROVED
            ? 'Loan sanctioned'
            : app.kycStatus === 1
              ? 'KYC cleared'
              : app.applicationStatus.name === APPLICATION_STATUS.IN_REVIEW
                ? 'Credit review queue'
                : 'Application updated';

      return {
        id: app.uuid,
        title,
        actor: `${name} · …${tail} — now ${statusLabel}.`,
        timeIso: app.updatedAt.toISOString(),
      };
    });

    const dailySeries = mergeLosDashboardDailySeries(dayKeys, leadDailyRows, appDailyRows, disbDailyRows);

    return {
      generatedAt: new Date().toISOString(),
      activeAgentsToday,
      customers: customerCount,
      newLeadsToday,
      newApplicationsToday,
      dailySeries,
      leadsByStatus,
      applicationsByStatus,
      pipeline: {
        freshLeads,
        applicationInProgress,
        kycPendingInReview: kycPendingInFlow,
        livenessPending,
        approvedCount,
        disbursedCount,
      },
      amounts: {
        sanctionedOpenPipelineInr: sanctionedPipelineAgg._sum.approvedAmount?.toString() ?? null,
        disbursedTodayInr: disbursedTodayAgg._sum.amount?.toString() ?? null,
        avgRequestedLoanInr: avgLoanAgg._avg.loanAmount?.toString() ?? null,
      },
      credit: {
        approvalRatePercent,
        approvedTotal: approvedCount,
        rejectedTotal: rejectedAppCount,
      },
      recentActivity,
    };
  }

  private mapAuditUser(
    user: { id: bigint; fullName: string; email: string } | null | undefined,
  ): LosAuditUser {
    if (!user) return null;
    return {
      id: user.id.toString(),
      fullName: user.fullName,
      email: user.email,
    };
  }

  private mapNegativePincode(row: {
    id: number;
    pincode: string;
    reason: string | null;
    isActive: boolean;
    createdAt: Date;
    removedAt: Date | null;
    addedBy: { id: bigint; fullName: string; email: string } | null;
    removedBy: { id: bigint; fullName: string; email: string } | null;
  }) {
    return {
      id: row.id,
      pincode: row.pincode,
      reason: row.reason,
      isActive: row.isActive,
      addedAt: row.createdAt.toISOString(),
      removedAt: row.removedAt?.toISOString() ?? null,
      addedBy: this.mapAuditUser(row.addedBy),
      removedBy: this.mapAuditUser(row.removedBy),
    };
  }

  private mapNegativeCity(row: {
    id: number;
    cityId: number;
    reason: string | null;
    isActive: boolean;
    createdAt: Date;
    removedAt: Date | null;
    city: { name: string; state: { name: string; code: string } };
    addedBy: { id: bigint; fullName: string; email: string } | null;
    removedBy: { id: bigint; fullName: string; email: string } | null;
  }) {
    return {
      id: row.id,
      cityId: row.cityId,
      cityName: row.city.name,
      stateName: row.city.state.name,
      stateCode: row.city.state.code,
      reason: row.reason,
      isActive: row.isActive,
      addedAt: row.createdAt.toISOString(),
      removedAt: row.removedAt?.toISOString() ?? null,
      addedBy: this.mapAuditUser(row.addedBy),
      removedBy: this.mapAuditUser(row.removedBy),
    };
  }

  private mapNegativeState(row: {
    id: number;
    stateId: number;
    reason: string | null;
    isActive: boolean;
    createdAt: Date;
    removedAt: Date | null;
    state: { name: string; code: string };
    addedBy: { id: bigint; fullName: string; email: string } | null;
    removedBy: { id: bigint; fullName: string; email: string } | null;
  }) {
    return {
      id: row.id,
      stateId: row.stateId,
      stateName: row.state.name,
      stateCode: row.state.code,
      reason: row.reason,
      isActive: row.isActive,
      addedAt: row.createdAt.toISOString(),
      removedAt: row.removedAt?.toISOString() ?? null,
      addedBy: this.mapAuditUser(row.addedBy),
      removedBy: this.mapAuditUser(row.removedBy),
    };
  }

  private parseLosUserId(userId: string): bigint {
    try {
      return BigInt(userId);
    } catch {
      throw new BadRequestException('Invalid LOS user session.');
    }
  }

  async getNegativeListsForLos() {
    const [pincodes, cities, states] = await Promise.all([
      this.prisma.client.negativePincode.findMany({
        include: negativePincodeInclude,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.client.negativeCity.findMany({
        include: negativeCityInclude,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.client.negativeState.findMany({
        include: negativeStateInclude,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return {
      pincodes: pincodes.map((row) => this.mapNegativePincode(row)),
      cities: cities.map((row) => this.mapNegativeCity(row)),
      states: states.map((row) => this.mapNegativeState(row)),
    };
  }

  async addNegativePincode(userId: string, dto: CreateNegativePincodeDto) {
    const pincode = dto.pincode.trim();
    const addedByUserId = this.parseLosUserId(userId);
    const reason = dto.reason?.trim() || null;

    const existing = await this.prisma.client.negativePincode.findUnique({
      where: { pincode },
      include: negativePincodeInclude,
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('This pincode is already on the negative list.');
      }

      const row = await this.prisma.client.negativePincode.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          reason,
          addedByUserId,
          removedByUserId: null,
          removedAt: null,
          createdAt: new Date(),
        },
        include: negativePincodeInclude,
      });
      return this.mapNegativePincode(row);
    }

    const row = await this.prisma.client.negativePincode.create({
      data: { pincode, reason, isActive: true, addedByUserId },
      include: negativePincodeInclude,
    });
    return this.mapNegativePincode(row);
  }

  async removeNegativePincode(userId: string, id: number) {
    const removedByUserId = this.parseLosUserId(userId);
    const existing = await this.prisma.client.negativePincode.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Negative pincode entry not found.');
    }
    if (!existing.isActive) {
      throw new BadRequestException('This pincode is already removed from the negative list.');
    }

    const row = await this.prisma.client.negativePincode.update({
      where: { id },
      data: {
        isActive: false,
        removedByUserId,
        removedAt: new Date(),
      },
      include: negativePincodeInclude,
    });
    return this.mapNegativePincode(row);
  }

  async addNegativeCity(userId: string, dto: CreateNegativeCityDto) {
    const addedByUserId = this.parseLosUserId(userId);
    const reason = dto.reason?.trim() || null;

    const city = await this.prisma.client.city.findUnique({ where: { id: dto.cityId } });
    if (!city) {
      throw new NotFoundException('City not found.');
    }

    const existing = await this.prisma.client.negativeCity.findUnique({
      where: { cityId: dto.cityId },
      include: negativeCityInclude,
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('This city is already on the negative list.');
      }

      const row = await this.prisma.client.negativeCity.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          reason,
          addedByUserId,
          removedByUserId: null,
          removedAt: null,
          createdAt: new Date(),
        },
        include: negativeCityInclude,
      });
      return this.mapNegativeCity(row);
    }

    const row = await this.prisma.client.negativeCity.create({
      data: { cityId: dto.cityId, reason, isActive: true, addedByUserId },
      include: negativeCityInclude,
    });
    return this.mapNegativeCity(row);
  }

  async removeNegativeCity(userId: string, id: number) {
    const removedByUserId = this.parseLosUserId(userId);
    const existing = await this.prisma.client.negativeCity.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Negative city entry not found.');
    }
    if (!existing.isActive) {
      throw new BadRequestException('This city is already removed from the negative list.');
    }

    const row = await this.prisma.client.negativeCity.update({
      where: { id },
      data: {
        isActive: false,
        removedByUserId,
        removedAt: new Date(),
      },
      include: negativeCityInclude,
    });
    return this.mapNegativeCity(row);
  }

  async addNegativeState(userId: string, dto: CreateNegativeStateDto) {
    const addedByUserId = this.parseLosUserId(userId);
    const reason = dto.reason?.trim() || null;

    const state = await this.prisma.client.state.findUnique({ where: { id: dto.stateId } });
    if (!state) {
      throw new NotFoundException('State not found.');
    }

    const existing = await this.prisma.client.negativeState.findUnique({
      where: { stateId: dto.stateId },
      include: negativeStateInclude,
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('This state is already on the negative list.');
      }

      const row = await this.prisma.client.negativeState.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          reason,
          addedByUserId,
          removedByUserId: null,
          removedAt: null,
          createdAt: new Date(),
        },
        include: negativeStateInclude,
      });
      return this.mapNegativeState(row);
    }

    const row = await this.prisma.client.negativeState.create({
      data: { stateId: dto.stateId, reason, isActive: true, addedByUserId },
      include: negativeStateInclude,
    });
    return this.mapNegativeState(row);
  }

  async removeNegativeState(userId: string, id: number) {
    const removedByUserId = this.parseLosUserId(userId);
    const existing = await this.prisma.client.negativeState.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Negative state entry not found.');
    }
    if (!existing.isActive) {
      throw new BadRequestException('This state is already removed from the negative list.');
    }

    const row = await this.prisma.client.negativeState.update({
      where: { id },
      data: {
        isActive: false,
        removedByUserId,
        removedAt: new Date(),
      },
      include: negativeStateInclude,
    });
    return this.mapNegativeState(row);
  }
}
