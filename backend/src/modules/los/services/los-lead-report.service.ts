import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { APPLICATION_STATUS } from '../../../common/constants/application.constants';
import { LOAN_STATUS } from '../../../common/constants/loan.constants';
import { REJECTION_REASON, toRejectionReasonDto } from '../../../common/constants/rejection-reason.constants';
import { CUSTOMER_TYPE_LABEL } from '../../../common/constants/customer-type.constants';
import {
  loadClosedLoanLeadIdsByCustomer,
  resolveCustomerType,
  type ClosedLoanLeadIdsByCustomer,
} from '../../../common/loan/customer-recurring-status.util';
import { resolveEffectiveLoanStatus } from '../../../common/loan/effective-loan-status.util';
import {
  LEAD_REPORT_REPAYMENT_STATUS,
  resolveLeadReportRepaymentStatus,
} from '../../../common/loan/lead-report-repayment-status.util';
import { computeFeeAmountsFromLoanDetail } from '../../../common/loan/loan-disbursement-view.util';
import { overlayLiveRepaymentDueDateIfSelected, resolveRepaymentDueDateUtc } from '../../../common/loan/repayment-due-date.util';
import { TENACIO_SERVICE_PAN_NAME_DOB } from '../../../common/vendor/tenacio/tenacio-client.service';
import { streamXlsxWorkbook, type SimpleXlsxCell } from '../../../common/xlsx/simple-xlsx';
import {
  EXPORT_EMPTY_FILTER_VALUE,
  matchesExportDateFilter,
  matchesExportDatetimeRangeFilter,
  matchesExportMultiSelectFilter,
  matchesExportNumberRangeFilter,
  matchesExportTextFilter,
  parseExportDateOnly,
  parseExportDatetimeRange,
  parseExportNumberRange,
  requireAtLeastOneExportFilter,
} from '../../../common/xlsx/export-row-filter.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatLosPersonName } from '../format-los-person-name';
import type { ExportLeadReportsQueryDto } from '../los-data.controller';

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

/**
 * Same fallback as the Applications table's `mapLeadRejectionReason`: a penny-drop failure only
 * sets `rejectionReasonId` on the application, not the lead, so a lead with no `rejectionReason`
 * of its own still needs the synthetic "Penny drop failed" label when its latest application
 * status says so — otherwise that row's rejection reason reads blank.
 */
function mapLeadRejectionReason(
  reason: { name: string } | null | undefined,
  applicationStatusName?: string | null,
): { code: string; label: string } | null {
  const mapped = toRejectionReasonDto(reason ?? null);
  if (mapped) return mapped;
  if (applicationStatusName === APPLICATION_STATUS.PENNYDROP_FAILED) {
    return toRejectionReasonDto({ name: REJECTION_REASON.PENNYDROP_FAILED });
  }
  return null;
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

/**
 * Safe-superset raw `loan_status.name` values for an effective loan-status filter value.
 * `resolveEffectiveLoanStatus` only ever relabels a raw ACTIVE loan past maturity as OVERDUE — every
 * other effective value maps 1:1 onto the same raw name — so this is exhaustive, not a guess.
 */
function loanStatusRawSuperset(effective: string): string[] {
  return effective.toUpperCase() === LOAN_STATUS.OVERDUE
    ? [LOAN_STATUS.OVERDUE, LOAN_STATUS.ACTIVE]
    : [effective];
}

/**
 * Safe-superset raw `loan_status.name` values for a Lead Report repayment-status filter value —
 * the reverse of `resolveLeadReportRepaymentStatus`'s branches. `null` means there's no safe
 * stored-column equivalent (`NOT_APPLICABLE` means "no loan at all"), so that value's rows stay
 * entirely on the JS pass.
 */
function repaymentStatusRawLoanStatusSuperset(effective: string): string[] | null {
  switch (effective.toUpperCase()) {
    case LEAD_REPORT_REPAYMENT_STATUS.WRITTEN_OFF:
      return [LOAN_STATUS.WRITTEN_OFF];
    case LEAD_REPORT_REPAYMENT_STATUS.PAID:
      return [LOAN_STATUS.SETTLED, LOAN_STATUS.CLOSED];
    case LEAD_REPORT_REPAYMENT_STATUS.OVERDUE:
      return [LOAN_STATUS.OVERDUE, LOAN_STATUS.ACTIVE];
    // FAILED / PARTIALLY_PAID / PENDING are only reached when the effective loan status is
    // ACTIVE (not past maturity) — the raw repayment status further narrows within the JS pass.
    case LEAD_REPORT_REPAYMENT_STATUS.FAILED:
    case LEAD_REPORT_REPAYMENT_STATUS.PARTIALLY_PAID:
    case LEAD_REPORT_REPAYMENT_STATUS.PENDING:
      return [LOAN_STATUS.ACTIVE];
    default:
      return null;
  }
}

const leadReportInclude = {
  customer: { select: { uuid: true, mobileNumber: true } },
  leadStatus: { select: { name: true, displayName: true } },
  rejectionReason: { select: { name: true } },
  leadDetail: {
    select: {
      fullName: true,
      dateOfBirth: true,
      panNumber: true,
      pincode: true,
      addressLine1: true,
      addressLine2: true,
      emailId: true,
      netMonthlyIncome: true,
      city: { select: { name: true, state: { select: { name: true, code: true } } } },
      gender: { select: { name: true } },
      occupation: { select: { name: true } },
      bureauReport: {
        select: {
          cibilScore: true,
          cibilCreditAssessment: { select: { category: true } },
        },
      },
    },
  },
  vendorApiLogs: {
    where: { serviceName: { in: panNsdlServiceNames() } },
    orderBy: [{ respondedAt: 'desc' as const }, { id: 'desc' as const }],
    take: 1,
    select: { requestPayload: true, responsePayload: true },
  },
  leadUtms: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { utmSource: true, utmMedium: true, utmCampaign: true, utmTerm: true, utmContent: true },
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

/** Batch size for the export's cursor-paged fetch. */
const EXPORT_BATCH_SIZE = 100;

function moneyOrNull(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return (Math.round(value * 100) / 100).toFixed(2);
}

function mapLeadReport(
  lead: LeadReportRecord,
  liveRepayDate: Date | null | undefined,
  closedLoanLeadIds: ClosedLoanLeadIdsByCustomer,
) {
  const profile = lead.leadDetail;
  const application = lead.applications[0] ?? null;
  const loan = application?.loanAccount ?? null;
  const details = loan
    ? application?.details ?? null
    : overlayLiveRepaymentDueDateIfSelected(application?.details, liveRepayDate) ??
      application?.details ??
      null;
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
  const rejectionReason = mapLeadRejectionReason(lead.rejectionReason, application?.applicationStatus.name);
  const customerType = resolveCustomerType(closedLoanLeadIds, lead.customerId, lead.id);
  const panLog = lead.vendorApiLogs[0];
  const latestUtm = lead.leadUtms[0] ?? null;
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
    email: profile?.emailId?.trim() || details?.emailId?.trim() || null,
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
    cibilScore: profile?.bureauReport?.cibilScore ?? null,
    cibilCreditAssessmentCategory: profile?.bureauReport?.cibilCreditAssessment?.category ?? null,
    leadStatusCode: lead.leadStatus.name,
    leadStatusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
    rejectionReasonCode: rejectionReason?.code ?? null,
    rejectionReasonLabel: rejectionReason?.label ?? null,
    rejectionNote: lead.leadStatusNote?.trim() || null,
    customerType,
    customerTypeLabel: CUSTOMER_TYPE_LABEL[customerType],
    utmSource: latestUtm?.utmSource ?? null,
    utmMedium: latestUtm?.utmMedium ?? null,
    utmCampaign: latestUtm?.utmCampaign ?? null,
    utmTerm: latestUtm?.utmTerm ?? null,
    utmContent: latestUtm?.utmContent ?? null,
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
  'Grade',
<<<<<<< HEAD
=======
  'Customer type',
>>>>>>> refs/remotes/moneycash/main
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
  'Rejection reason',
  'Rejection note',
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
  'UTM source',
  'UTM medium',
  'UTM campaign',
  'UTM term',
  'UTM content',
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
    const [leads, liveRepayDate, closedLoanLeadIds] = await Promise.all([
      this.prisma.read.lead.findMany({
        where: { isInternalTesting: false },
        orderBy: { createdAt: 'desc' },
        include: leadReportInclude,
      }),
      resolveRepaymentDueDateUtc(this.prisma.client),
      loadClosedLoanLeadIdsByCustomer(this.prisma.read),
    ]);
    return leads.map((lead) => mapLeadReport(lead, liveRepayDate, closedLoanLeadIds));
  }

  async getLeadReportDetails(leadUuid: string) {
    const [lead, liveRepayDate, closedLoanLeadIds] = await Promise.all([
      this.prisma.read.lead.findUnique({
        where: { uuid: leadUuid },
        include: leadReportInclude,
      }),
      resolveRepaymentDueDateUtc(this.prisma.client),
      loadClosedLoanLeadIdsByCustomer(this.prisma.read),
    ]);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return mapLeadReport(lead, liveRepayDate, closedLoanLeadIds);
  }

<<<<<<< HEAD
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
        row.cibilCreditAssessmentCategory,
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
=======
  private matchesExportFilters(
    row: ReturnType<typeof mapLeadReport>,
    query: ExportLeadReportsQueryDto,
  ): boolean {
    if (query.lead && !matchesExportTextFilter(row.leadNumber, query.lead)) return false;
    if (query.customer && !matchesExportTextFilter(row.panCardName ?? row.fullName, query.customer))
      return false;
    if (query.mobile && !matchesExportTextFilter(row.mobileNumber, query.mobile)) return false;
    if (query.pan && !matchesExportTextFilter(row.panNumber, query.pan)) return false;
    if (query.dob && !matchesExportDateFilter(row.dateOfBirth, query.dob)) return false;
    if (query.city && !matchesExportMultiSelectFilter(row.city, query.city)) return false;
    if (query.state && !matchesExportMultiSelectFilter(row.state, query.state)) return false;
    if (query.purpose && !matchesExportMultiSelectFilter(row.purposeOfLoan, query.purpose)) return false;
    if (
      query.offerAmount &&
      !matchesExportNumberRangeFilter(row.loanOfferAmount, query.offerAmount, 'offerAmount')
    )
      return false;
    if (
      query.selectedAmount &&
      !matchesExportNumberRangeFilter(row.loanSelectedAmount, query.selectedAmount, 'selectedAmount')
    )
      return false;
    if (query.cibil && !matchesExportNumberRangeFilter(row.cibilScore, query.cibil, 'cibil')) return false;
    if (query.grade && !matchesExportMultiSelectFilter(row.cibilCreditAssessmentCategory, query.grade))
      return false;
    if (query.customerType && !matchesExportMultiSelectFilter(row.customerType, query.customerType))
      return false;
    if (query.leadStatus && !matchesExportMultiSelectFilter(row.leadStatusCode, query.leadStatus))
      return false;
    if (query.reason) {
      const haystack = [row.rejectionReasonCode, row.rejectionReasonLabel, row.rejectionNote]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query.reason.trim().toLowerCase())) return false;
    }
    if (query.utmSource && !matchesExportTextFilter(row.utmSource, query.utmSource)) return false;
    if (query.utmMedium && !matchesExportTextFilter(row.utmMedium, query.utmMedium)) return false;
    if (query.utmCampaign && !matchesExportTextFilter(row.utmCampaign, query.utmCampaign)) return false;
    if (query.utmTerm && !matchesExportTextFilter(row.utmTerm, query.utmTerm)) return false;
    if (query.utmContent && !matchesExportTextFilter(row.utmContent, query.utmContent)) return false;
    if (
      query.applicationStatus &&
      !matchesExportMultiSelectFilter(row.applicationStatusCode, query.applicationStatus)
    )
      return false;
    if (query.loanStatus && !matchesExportMultiSelectFilter(row.loanStatusCode, query.loanStatus))
      return false;
    if (
      query.repaymentStatus &&
      !matchesExportMultiSelectFilter(row.repaymentStatusCode, query.repaymentStatus)
    )
      return false;
    if (query.created && !matchesExportDatetimeRangeFilter(row.createdAt, query.created, 'created'))
      return false;
    return true;
  }

  private leadReportRowCells(row: ReturnType<typeof mapLeadReport>): SimpleXlsxCell[] {
    return [
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
      row.cibilCreditAssessmentCategory,
      row.customerTypeLabel,
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
      row.rejectionReasonLabel,
      row.rejectionNote,
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
      row.utmSource,
      row.utmMedium,
      row.utmCampaign,
      row.utmTerm,
      row.utmContent,
      toExcelDate(row.createdAt),
      row.uuid,
      row.customerUuid,
      row.applicationUuid,
      row.loanUuid,
>>>>>>> refs/remotes/moneycash/main
    ];
  }

  /**
   * Mirrors the LOS Lead Report table's own column filters (same field names as the table's
   * column keys). Almost every column here is a derived label computed by `mapLeadReport` (loan
   * status, repayment status, panCardName's vendor-log fallback, …) rather than a plain stored
   * column, so the JS matcher pass (`matchesExportFilters`) stays the source of truth for every
   * field, exactly as before. But most fields here *do* map 1:1 (or as a safe superset, via a
   * relation `some`) onto a real column, so `buildExportWhere` pushes those down as a Prisma
   * `where` to shrink what the batched fetch pulls back — including `loanStatus` and
   * `repaymentStatus`, via the exhaustive raw-`loan_status.name` supersets in
   * `loanStatusRawSuperset` / `repaymentStatusRawLoanStatusSuperset`. Only `customer` has no safe
   * SQL equivalent at all (it falls back to a panCardName parsed from a vendor-log JSON payload) and
   * is left entirely to the JS pass. Requires at least one filter, same as the download button
   * staying disabled until a filter matches a row. Streams straight to `res`, cursor-paged from the
   * DB in batches.
   */
  async exportLeadReportsWorkbook(query: ExportLeadReportsQueryDto, res: Response): Promise<void> {
    requireAtLeastOneExportFilter(
      Object.values(query),
      'Apply at least one filter before downloading the lead report dump.',
    );
    const where = this.buildExportWhere(query);

    await streamXlsxWorkbook(res, {
      sheetName: 'Lead report',
      headers: LEAD_REPORT_HEADERS,
      rows: this.streamLeadReportsForExport(where, query),
    });
  }

  /**
   * Best-effort SQL pre-filter for `exportLeadReportsWorkbook` — every condition here is either an
   * exact 1:1 mapping to a stored column, or (for `applications`/`leadUtms`, which the report only
   * reads the *latest* row of) a `some` match that's a safe superset of the JS pass's real
   * condition. Either way `matchesExportFilters` still re-checks every row afterward, so a bug here
   * can only ever over-fetch, never silently drop a row that should be in the report.
   */
  private buildExportWhere(query: ExportLeadReportsQueryDto): Prisma.LeadWhereInput {
    const and: Prisma.LeadWhereInput[] = [];

    const leadText = query.lead?.trim();
    if (leadText) and.push({ leadNumber: { contains: leadText } });

    const mobileText = query.mobile?.trim();
    if (mobileText) and.push({ customer: { mobileNumber: { contains: mobileText } } });

    const panText = query.pan?.trim();
    if (panText) and.push({ leadDetail: { panNumber: { contains: panText } } });

    const dob = parseExportDateOnly(query.dob, 'dob');
    if (dob) and.push({ leadDetail: { dateOfBirth: dob } });

    const cityValues = this.multiSelectSqlValues(query.city);
    if (cityValues) and.push({ leadDetail: { city: { name: { in: cityValues } } } });

    const stateValues = this.multiSelectSqlValues(query.state);
    if (stateValues) and.push({ leadDetail: { city: { state: { name: { in: stateValues } } } } });

    const purposeValues = this.multiSelectSqlValues(query.purpose);
    if (purposeValues) {
      and.push({
        applications: { some: { details: { reasonForLoan: { name: { in: purposeValues } } } } },
      });
    }

    const offerAmountRange = parseExportNumberRange(query.offerAmount, 'offerAmount');
    if (offerAmountRange) {
      and.push({
        applications: {
          some: {
            preApprovedLoanAmount: {
              ...(offerAmountRange.min != null ? { gte: offerAmountRange.min } : {}),
              ...(offerAmountRange.max != null ? { lte: offerAmountRange.max } : {}),
            },
          },
        },
      });
    }

    const selectedAmountRange = parseExportNumberRange(query.selectedAmount, 'selectedAmount');
    if (selectedAmountRange) {
      and.push({
        applications: {
          some: {
            details: {
              selectedLoanAmount: {
                ...(selectedAmountRange.min != null ? { gte: selectedAmountRange.min } : {}),
                ...(selectedAmountRange.max != null ? { lte: selectedAmountRange.max } : {}),
              },
            },
          },
        },
      });
    }

    const cibilRange = parseExportNumberRange(query.cibil, 'cibil');
    if (cibilRange) {
      and.push({
        leadDetail: {
          bureauReport: {
            cibilScore: {
              ...(cibilRange.min != null ? { gte: cibilRange.min } : {}),
              ...(cibilRange.max != null ? { lte: cibilRange.max } : {}),
            },
          },
        },
      });
    }

    const gradeValues = this.multiSelectSqlValues(query.grade);
    if (gradeValues) {
      and.push({
        leadDetail: { bureauReport: { cibilCreditAssessment: { category: { in: gradeValues } } } },
      });
    }

    const leadStatusValues = this.multiSelectSqlValues(query.leadStatus);
    if (leadStatusValues) and.push({ leadStatus: { name: { in: leadStatusValues } } });

    const applicationStatusValues = this.multiSelectSqlValues(query.applicationStatus);
    if (applicationStatusValues) {
      and.push({
        applications: { some: { applicationStatus: { name: { in: applicationStatusValues } } } },
      });
    }

    const utmSourceText = query.utmSource?.trim();
    if (utmSourceText) and.push({ leadUtms: { some: { utmSource: { contains: utmSourceText } } } });

    const utmMediumText = query.utmMedium?.trim();
    if (utmMediumText) and.push({ leadUtms: { some: { utmMedium: { contains: utmMediumText } } } });

    const utmCampaignText = query.utmCampaign?.trim();
    if (utmCampaignText) and.push({ leadUtms: { some: { utmCampaign: { contains: utmCampaignText } } } });

    const utmTermText = query.utmTerm?.trim();
    if (utmTermText) and.push({ leadUtms: { some: { utmTerm: { contains: utmTermText } } } });

    const utmContentText = query.utmContent?.trim();
    if (utmContentText) and.push({ leadUtms: { some: { utmContent: { contains: utmContentText } } } });

    const createdRange = parseExportDatetimeRange(query.created, 'created');
    if (createdRange) and.push({ createdAt: { gte: createdRange.start, lte: createdRange.end } });

    // `loanStatus` and `repaymentStatus` are derived labels, not stored columns, but each maps onto
    // a known, exhaustive superset of raw `loan_status.name` values (see the two helpers above) —
    // pushing that superset down still shrinks what the batched fetch pulls back, and
    // `matchesExportFilters` re-checks the exact effective value on every row afterward, so this can
    // only ever over-fetch, never silently drop a row that should be in the report.
    const loanStatusValues = this.multiSelectSqlValues(query.loanStatus);
    if (loanStatusValues) {
      const rawStatuses = [...new Set(loanStatusValues.flatMap((value) => loanStatusRawSuperset(value)))];
      and.push({ applications: { some: { loanAccount: { loanStatus: { name: { in: rawStatuses } } } } } });
    }

    const repaymentStatusValues = this.multiSelectSqlValues(query.repaymentStatus);
    if (repaymentStatusValues) {
      const rawSupersets = repaymentStatusValues.map((value) => repaymentStatusRawLoanStatusSuperset(value));
      // Any value with no safe superset (`NOT_APPLICABLE` — no loan at all) forces the whole filter
      // back onto the JS pass instead of risking a `some` that can't express "no loan".
      if (rawSupersets.every((set) => set != null)) {
        const rawStatuses = [...new Set(rawSupersets.flatMap((set) => set as string[]))];
        and.push({ applications: { some: { loanAccount: { loanStatus: { name: { in: rawStatuses } } } } } });
      }
    }

    // Not pushed to SQL — no safe stored-column equivalent, JS pass (`matchesExportFilters`)
    // stays the only judge:
    //  - `customer`: matches panCardName (parsed from a vendor-log JSON payload) falling back to
    //    fullName — a DB `contains` on fullName alone could exclude rows that only match via
    //    panCardName.
    //  - `reason`: matches across rejection reason code, label, *and* the free-text lead status
    //    note (plus the synthetic penny-drop fallback) — same rationale as the Applications
    //    table's own `reason` filter.

    return and.length > 0 ? { AND: and } : {};
  }

  /**
   * Parses a comma-separated multi-select filter value into the list to use in a SQL `in`. Returns
   * null (meaning: don't add a SQL condition, leave this field entirely to the JS pass) when the
   * filter is unset, or when it includes the "(blank)" sentinel — matching that would require an
   * `OR field IS NULL` this helper doesn't attempt, and skipping is always safe (over-fetch only).
   */
  private multiSelectSqlValues(filterValue: string | undefined): string[] | null {
    const trimmed = filterValue?.trim();
    if (!trimmed) return null;
    const selected = [...new Set(trimmed.split(',').map((v) => v.trim()).filter(Boolean))];
    if (selected.length === 0) return null;
    if (selected.some((v) => v.toLowerCase() === EXPORT_EMPTY_FILTER_VALUE.toLowerCase())) return null;
    return selected;
  }

  private async *streamLeadReportsForExport(
    where: Prisma.LeadWhereInput,
    query: ExportLeadReportsQueryDto,
  ): AsyncGenerator<SimpleXlsxCell[]> {
    let cursorId: bigint | undefined;
    const [liveRepayDate, closedLoanLeadIds] = await Promise.all([
      resolveRepaymentDueDateUtc(this.prisma.client),
      loadClosedLoanLeadIdsByCustomer(this.prisma.read),
    ]);

    for (;;) {
      const batch = await this.prisma.read.lead.findMany({
        take: EXPORT_BATCH_SIZE,
        ...(cursorId != null ? { skip: 1, cursor: { id: cursorId } } : {}),
        where: { isInternalTesting: false, ...where },
        orderBy: { id: 'desc' },
        include: leadReportInclude,
      });
      if (batch.length === 0) return;

      for (const record of batch) {
        const row = mapLeadReport(record, liveRepayDate, closedLoanLeadIds);
        if (!this.matchesExportFilters(row, query)) continue;
        yield this.leadReportRowCells(row);
      }

      cursorId = batch[batch.length - 1]!.id;
      if (batch.length < EXPORT_BATCH_SIZE) return;
    }
  }
}
