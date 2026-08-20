import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { resolveEffectiveLoanStatus } from '../../../common/loan/effective-loan-status.util';
import { resolveLeadReportRepaymentStatus } from '../../../common/loan/lead-report-repayment-status.util';
import { computeFeeAmountsFromLoanDetail } from '../../../common/loan/loan-disbursement-view.util';
import { TENACIO_SERVICE_PAN_NAME_DOB } from '../../../common/vendor/tenacio/tenacio-client.service';
import { buildSimpleXlsxWorkbook, type SimpleXlsxCell } from '../../../common/xlsx/simple-xlsx';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatLosPersonName } from '../format-los-person-name';

function displayName(name: string, custom: string | null | undefined): string {
  return (custom?.trim() || name).trim();
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

function samePublicId(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = left?.trim().toUpperCase();
  const b = right?.trim().toUpperCase();
  return Boolean(a && b && a === b);
}

function isoDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function panNsdlServiceNames(): string[] {
  return [...new Set(
    [(process.env.TENACIO_PAN_NSDL_SERVICE ?? '').trim(), TENACIO_SERVICE_PAN_NAME_DOB].filter(Boolean),
  )];
}

function pickPersonName(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return formatLosPersonName(value);
}

/** PAN name from NSDL vendor response, else the name submitted for PAN verification. */
function extractPanCardName(input: {
  responsePayload?: unknown;
  requestPayload?: unknown;
  fallback: string | null;
}): string | null {
  const response = asRecord(input.responsePayload);
  const responseData = asRecord(response?.data);
  const request = asRecord(input.requestPayload);
  const requestInput = asRecord(request?.input);
  const candidates = [
    responseData?.fullName,
    responseData?.name,
    responseData?.registeredName,
    responseData?.panName,
    response?.fullName,
    response?.name,
    requestInput?.name,
    requestInput?.fullName,
    request?.name,
  ];
  for (const value of candidates) {
    const name = pickPersonName(value);
    if (name) return name;
  }
  return input.fallback;
}

const leadReportInclude = {
  customer: { select: { uuid: true, mobileNumber: true } },
  leadStatus: { select: { name: true, displayName: true } },
  leadDetail: {
    select: {
      fullName: true,
      dateOfBirth: true,
      panNumber: true,
      pincode: true,
      addressLine1: true,
      addressLine2: true,
      netMonthlyIncome: true,
      city: { select: { name: true, state: { select: { name: true, code: true } } } },
      gender: { select: { name: true } },
      occupation: { select: { name: true } },
    },
  },
  vendorApiLogs: {
    where: { serviceName: { in: panNsdlServiceNames() } },
    orderBy: [{ respondedAt: 'desc' as const }, { id: 'desc' as const }],
    take: 1,
    select: { requestPayload: true, responsePayload: true },
  },
  bureauReports: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { cibilScore: true },
  },
  applications: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      uuid: true,
      applicationNumber: true,
      preApprovedLoanAmount: true,
      applicationStatus: { select: { name: true, displayName: true } },
      details: {
        select: {
          emailId: true,
          selectedLoanAmount: true,
          interestRate: true,
          processingFeePercentage: true,
          gstPercentage: true,
          expectedRepaymentDays: true,
          expectedRepaymentDate: true,
          reasonForLoan: { select: { name: true } },
        },
      },
      loanAccount: {
        select: {
          uuid: true,
          loanNumber: true,
          principalAmount: true,
          netDisbursedAmount: true,
          interestAmount: true,
          totalRepaymentAmount: true,
          disbursedAt: true,
          loanMaturityDate: true,
          closedAt: true,
          loanStatus: { select: { name: true, displayName: true } },
          repayments: {
            orderBy: { paidAt: 'desc' as const },
            take: 1,
            select: { status: true, amount: true, paidAt: true },
          },
        },
      },
    },
  },
} satisfies Prisma.LeadInclude;

type LeadReportRecord = Prisma.LeadGetPayload<{ include: typeof leadReportInclude }>;

function moneyOrNull(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return (Math.round(value * 100) / 100).toFixed(2);
}

function mapLeadReport(lead: LeadReportRecord) {
  const profile = lead.leadDetail;
  const application = lead.applications[0] ?? null;
  const details = application?.details ?? null;
  const loan = application?.loanAccount ?? null;
  const latestRepayment = loan?.repayments[0] ?? null;
  const effectiveLoan = loan
    ? resolveEffectiveLoanStatus({
        statusName: loan.loanStatus.name,
        statusDisplayName: loan.loanStatus.displayName,
        loanMaturityDate: loan.loanMaturityDate,
        closedAt: loan.closedAt,
      })
    : null;
  const repayment = resolveLeadReportRepaymentStatus({
    hasLoan: loan != null,
    loanStatusCode: effectiveLoan?.code ?? null,
    latestRepaymentStatus: latestRepayment?.status ?? null,
  });
  const enteredName = formatLosPersonName(profile?.fullName);
  const panLog = lead.vendorApiLogs[0];
  const fees = computeFeeAmountsFromLoanDetail(
    details
      ? {
          selectedLoanAmount: details.selectedLoanAmount,
          interestRate: details.interestRate,
          processingFeePercentage: details.processingFeePercentage,
          gstPercentage: details.gstPercentage,
          expectedRepaymentDays: details.expectedRepaymentDays,
          expectedRepaymentDate: details.expectedRepaymentDate,
        }
      : null,
    { preferStoredTenure: loan != null },
  );

  return {
    uuid: lead.uuid,
    leadNumber: lead.leadNumber,
    customerUuid: lead.customer.uuid,
    fullName: enteredName,
    panCardName: extractPanCardName({
      responsePayload: panLog?.responsePayload,
      requestPayload: panLog?.requestPayload,
      fallback: enteredName,
    }),
    mobileNumber: lead.customer.mobileNumber,
    email: details?.emailId?.trim() || null,
    dateOfBirth: isoDateOnly(profile?.dateOfBirth),
    panNumber: profile?.panNumber?.trim().toUpperCase() || null,
    gender: profile?.gender?.name ?? null,
    occupation: profile?.occupation?.name ?? null,
    city: profile?.city?.name ?? null,
    state: profile?.city?.state?.name ?? null,
    stateCode: profile?.city?.state?.code ?? null,
    pincode: profile?.pincode ?? null,
    address: [profile?.addressLine1, profile?.addressLine2].filter(Boolean).join(', ') || null,
    netMonthlyIncome: profile?.netMonthlyIncome?.toString() ?? null,
    cibilScore: lead.bureauReports[0]?.cibilScore ?? null,
    leadStatusCode: lead.leadStatus.name,
    leadStatusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
    applicationUuid: application?.uuid ?? null,
    applicationNumber: application?.applicationNumber ?? null,
    applicationStatusCode: application?.applicationStatus.name ?? null,
    applicationStatusLabel: application
      ? displayName(application.applicationStatus.name, application.applicationStatus.displayName)
      : null,
    purposeOfLoan: details?.reasonForLoan?.name ?? null,
    loanOfferAmount: application?.preApprovedLoanAmount?.toString() ?? null,
    loanSelectedAmount: details?.selectedLoanAmount?.toString() ?? null,
    interestRate: details?.interestRate?.toString() ?? null,
    processingFeePercent: details?.processingFeePercentage?.toString() ?? null,
    processingFeeAmount: moneyOrNull(fees.processingFeeAmount),
    gstPercent: details?.gstPercentage?.toString() ?? null,
    gstAmount: moneyOrNull(fees.gstAmount),
    expectedRepaymentDays: details?.expectedRepaymentDays ?? fees.tenureDays ?? null,
    expectedRepaymentDate: isoDateOnly(details?.expectedRepaymentDate),
    repaymentAmount: loan?.totalRepaymentAmount?.toString() ?? moneyOrNull(fees.repaymentAmount),
    loanUuid: loan?.uuid ?? null,
    loanNumber: loan?.loanNumber ?? null,
    loanStatusCode: effectiveLoan?.code ?? null,
    loanStatusLabel: effectiveLoan?.label ?? null,
    principalAmount: loan?.principalAmount?.toString() ?? null,
    netDisbursedAmount: loan?.netDisbursedAmount?.toString() ?? moneyOrNull(fees.disburseAmount),
    interestAmount: loan?.interestAmount?.toString() ?? moneyOrNull(fees.interestAmount),
    totalRepaymentAmount: loan?.totalRepaymentAmount?.toString() ?? moneyOrNull(fees.repaymentAmount),
    disbursedAt: loan?.disbursedAt?.toISOString() ?? null,
    loanMaturityDate: isoDateOnly(loan?.loanMaturityDate),
    repaymentStatusCode: repayment.code,
    repaymentStatusLabel: repayment.label,
    latestRepaymentAmount: latestRepayment?.amount?.toString() ?? null,
    latestRepaymentAt: latestRepayment?.paidAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

const LEAD_REPORT_HEADERS = [
  'Lead ID',
  'PAN card name',
  'Name',
  'Mobile',
  'Email',
  'DOB',
  'PAN',
  'Gender',
  'Occupation',
  'City',
  'State',
  'PIN',
  'Address',
  'Monthly income',
  'CIBIL',
  'Purpose of loan',
  'Loan offer amount',
  'Loan selected amount',
  'Tenure days',
  'Interest rate %',
  'Processing fee %',
  'Processing fee amount',
  'GST %',
  'GST amount',
  'Expected repay date',
  'Repayment amount',
  'Lead status',
  'Application ID',
  'Application status',
  'Loan ID',
  'Loan status',
  'Principal',
  'Net disbursed',
  'Interest amount',
  'Disbursed at',
  'Due date',
  'Repayment status',
  'Latest repayment amount',
  'Latest repayment at',
  'Created',
  'Lead UUID',
  'Customer UUID',
  'Application UUID',
  'Loan UUID',
] as const;

@Injectable()
export class LosLeadReportService {
  constructor(private readonly prisma: PrismaService) {}

  async listLeadReports() {
    const leads = await this.prisma.client.lead.findMany({
      where: { isInternalTesting: false },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      include: leadReportInclude,
    });
    return leads.map(mapLeadReport);
  }

  async getLeadReportDetails(leadUuid: string) {
    const lead = await this.prisma.client.lead.findUnique({
      where: { uuid: leadUuid },
      include: leadReportInclude,
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return mapLeadReport(lead);
  }

  async exportLeadReportsWorkbook(): Promise<Buffer> {
    const rows = await this.listLeadReports();
    const sheet: SimpleXlsxCell[][] = [
      [...LEAD_REPORT_HEADERS],
      ...rows.map((row) => [
        row.leadNumber,
        row.panCardName,
        row.fullName,
        row.mobileNumber,
        row.email,
        toExcelDate(row.dateOfBirth),
        row.panNumber,
        row.gender,
        row.occupation,
        row.city,
        row.state,
        row.pincode,
        row.address,
        toExcelNumber(row.netMonthlyIncome),
        toExcelNumber(row.cibilScore),
        row.purposeOfLoan,
        toExcelNumber(row.loanOfferAmount),
        toExcelNumber(row.loanSelectedAmount),
        row.expectedRepaymentDays,
        toExcelNumber(row.interestRate),
        toExcelNumber(row.processingFeePercent),
        toExcelNumber(row.processingFeeAmount),
        toExcelNumber(row.gstPercent),
        toExcelNumber(row.gstAmount),
        toExcelDate(row.expectedRepaymentDate),
        toExcelNumber(row.repaymentAmount),
        row.leadStatusLabel,
        samePublicId(row.leadNumber, row.applicationNumber) ? null : row.applicationNumber,
        row.applicationStatusLabel,
        samePublicId(row.leadNumber, row.loanNumber) ? null : row.loanNumber,
        row.loanStatusLabel,
        toExcelNumber(row.principalAmount),
        toExcelNumber(row.netDisbursedAmount),
        toExcelNumber(row.interestAmount),
        toExcelDate(row.disbursedAt),
        toExcelDate(row.loanMaturityDate),
        row.repaymentStatusCode === 'NOT_APPLICABLE' ? null : row.repaymentStatusLabel,
        toExcelNumber(row.latestRepaymentAmount),
        toExcelDate(row.latestRepaymentAt),
        toExcelDate(row.createdAt),
        row.uuid,
        row.customerUuid,
        row.applicationUuid,
        row.loanUuid,
      ]),
    ];
    return buildSimpleXlsxWorkbook(sheet, 'Lead report');
  }
}
