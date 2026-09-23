import { Injectable } from '@nestjs/common';
import { COLLECTED_REPAYMENT_STATUSES } from '../../../common/constants/loan-repayment.constants';
import { BounceChargeTierResolverService } from '../../../common/loan/bounce-charge-tier.resolver';
import { computePenalChargeInr } from '../../../common/loan/bounce-charge.util';
import { decimalToNumber } from '../../../common/loan/loan-calculation.util';
import { computeFeeAmountsFromLoanDetail } from '../../../common/loan/loan-disbursement-view.util';
import { loadRepayCoolingPeriodDays } from '../../../common/loan/repay-cooling-period.util';
import { resolveTransactionReportMetrics } from '../../../common/loan/transaction-report.util';
import { buildSimpleXlsxWorkbook, type SimpleXlsxCell } from '../../../common/xlsx/simple-xlsx';
import {
  matchesExportDateFilter,
  matchesExportDatetimeRangeFilter,
  matchesExportNumberFilter,
  matchesExportTextFilter,
  requireAtLeastOneExportFilter,
} from '../../../common/xlsx/export-row-filter.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatLosPersonName } from '../format-los-person-name';
import type { ExportTransactionReportsQueryDto } from '../los-data.controller';

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

function isoDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

const TRANSACTION_REPORT_HEADERS = [
  'Transaction',
  'Application ID',
  'Customer name',
  'Mobile number',
  'Email ID',
  'DOB',
  'PAN number',
  'Disbursement date',
  'Disbursed amount',
  'Interest received',
  'Interest rate %',
  'Processing fees %',
  'Processing fee amount',
  'GST on PF %',
  'GST amount',
  'Due date',
  'Repayment date',
  'Days exceeded from due date',
  'Penal charges',
] as const;

@Injectable()
export class LosTransactionReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bounceChargeTiers: BounceChargeTierResolverService,
  ) {}

  async listTransactionReports() {
    const loans = await this.prisma.read.loanAccount.findMany({
      where: {
        application: { lead: { isInternalTesting: false } },
      },
      orderBy: { disbursedAt: 'desc' },
      include: {
        customer: { select: { uuid: true, mobileNumber: true } },
        repayments: {
          where: { status: { in: COLLECTED_REPAYMENT_STATUSES } },
          orderBy: { paidAt: 'desc' },
          take: 1,
          select: { paidAt: true, utr: true },
        },
        application: {
          select: {
            uuid: true,
            applicationNumber: true,
            details: {
              select: {
                emailId: true,
                selectedLoanAmount: true,
                processingFeePercentage: true,
                gstPercentage: true,
                interestRate: true,
                expectedRepaymentDays: true,
              },
            },
            lead: {
              select: {
                uuid: true,
                leadDetail: {
                  select: { fullName: true, dateOfBirth: true, panNumber: true },
                },
              },
            },
          },
        },
      },
    });

    const penal = await this.bounceChargeTiers.loadPenalConfig();
    const coolingPeriodDays = await loadRepayCoolingPeriodDays(this.prisma.client);

    return loans.map((loan) => {
      const details = loan.application.details;
      const profile = loan.application.lead.leadDetail;
      const fees = computeFeeAmountsFromLoanDetail(
        details
          ? {
              selectedLoanAmount: details.selectedLoanAmount,
              interestRate: details.interestRate,
              processingFeePercentage: details.processingFeePercentage,
              gstPercentage: details.gstPercentage,
              expectedRepaymentDays: details.expectedRepaymentDays,
            }
          : null,
        { preferStoredTenure: true },
      );
      const repayment = loan.repayments[0] ?? null;
      const repaymentAt = repayment?.paidAt ?? loan.closedAt ?? null;
      const principal = decimalToNumber(loan.principalAmount);
      const dailyRate = decimalToNumber(loan.interestRate);
      const metrics = resolveTransactionReportMetrics({
        disbursedAt: loan.disbursedAt,
        dueDate: loan.loanMaturityDate,
        principal,
        interestRatePerDay: dailyRate,
        repaymentAt,
        coolingPeriodDays,
      });
      const penalCharges =
        principal != null ? computePenalChargeInr(principal, metrics.daysExceeded, penal) : 0;
      const loanNumber =
        typeof loan.loanNumber === 'string' && loan.loanNumber.trim()
          ? loan.loanNumber.trim()
          : loan.loanAccountNumber;
      const transactionId = (loan.utr?.trim() || repayment?.utr?.trim() || loanNumber).trim();

      return {
        uuid: loan.uuid,
        transactionId,
        loanNumber,
        applicationUuid: loan.application.uuid,
        applicationNumber: loan.application.applicationNumber,
        customerUuid: loan.customer.uuid,
        leadUuid: loan.application.lead.uuid,
        fullName: formatLosPersonName(profile?.fullName),
        mobileNumber: loan.customer.mobileNumber,
        email: details?.emailId?.trim() || null,
        dateOfBirth: isoDateOnly(profile?.dateOfBirth),
        panNumber: profile?.panNumber?.trim().toUpperCase() || null,
        disbursedAt: loan.disbursedAt.toISOString(),
        disbursedAmount: loan.netDisbursedAmount.toString(),
        interestReceived: metrics.interestReceived.toFixed(2),
        interestRate: loan.interestRate.toString(),
        processingFeePercent: details?.processingFeePercentage?.toString() ?? null,
        processingFeeAmount:
          fees.processingFeeAmount != null ? fees.processingFeeAmount.toFixed(2) : null,
        gstOnPfPercent: details?.gstPercentage?.toString() ?? null,
        gstAmount: fees.gstAmount != null ? fees.gstAmount.toFixed(2) : null,
        dueDate: isoDateOnly(loan.loanMaturityDate),
        repaymentAt: repaymentAt?.toISOString() ?? null,
        daysExceeded: metrics.daysExceeded,
        penalCharges: penalCharges.toFixed(2),
      };
    });
  }

  /**
   * Mirrors the LOS Transaction Report table's own column filters (same field names as the
   * table's column keys). Like the Lead Report export, every column here is computed by
   * `listTransactionReports`'s mapping rather than a stored DB column, so this filters the
   * already-mapped in-memory rows with the same matcher functions the frontend `DataTable` uses.
   * Requires at least one filter, same as the download button staying disabled until a filter
   * matches at least one row.
   */
  async exportTransactionReportsWorkbook(query: ExportTransactionReportsQueryDto): Promise<Buffer> {
    requireAtLeastOneExportFilter(
      Object.values(query),
      'Apply at least one filter before downloading the transaction report dump.',
    );
    const all = await this.listTransactionReports();
    const rows = all.filter((row) => {
      if (query.transaction && !matchesExportTextFilter(row.transactionId, query.transaction)) return false;
      if (query.application && !matchesExportTextFilter(row.applicationNumber, query.application)) return false;
      if (query.customer && !matchesExportTextFilter(row.fullName, query.customer)) return false;
      if (query.mobile && !matchesExportTextFilter(row.mobileNumber, query.mobile)) return false;
      if (query.email && !matchesExportTextFilter(row.email, query.email)) return false;
      if (query.dob && !matchesExportDateFilter(row.dateOfBirth, query.dob)) return false;
      if (query.pan && !matchesExportTextFilter(row.panNumber, query.pan)) return false;
      if (
        query.disbursedAt &&
        !matchesExportDatetimeRangeFilter(row.disbursedAt, query.disbursedAt, 'disbursedAt')
      )
        return false;
      if (
        query.disbursedAmount &&
        !matchesExportNumberFilter(row.disbursedAmount, query.disbursedAmount)
      )
        return false;
      if (
        query.interestReceived &&
        !matchesExportNumberFilter(row.interestReceived, query.interestReceived)
      )
        return false;
      if (query.interestRate && !matchesExportNumberFilter(row.interestRate, query.interestRate)) return false;
      if (
        query.processingFeePercent &&
        !matchesExportNumberFilter(row.processingFeePercent, query.processingFeePercent)
      )
        return false;
      if (
        query.processingFeeAmount &&
        !matchesExportNumberFilter(row.processingFeeAmount, query.processingFeeAmount)
      )
        return false;
      if (
        query.gstOnPfPercent &&
        !matchesExportNumberFilter(row.gstOnPfPercent, query.gstOnPfPercent)
      )
        return false;
      if (query.gstAmount && !matchesExportNumberFilter(row.gstAmount, query.gstAmount)) return false;
      if (query.dueDate && !matchesExportDateFilter(row.dueDate, query.dueDate)) return false;
      if (
        query.repaymentAt &&
        !matchesExportDatetimeRangeFilter(row.repaymentAt, query.repaymentAt, 'repaymentAt')
      )
        return false;
      if (query.daysExceeded && !matchesExportNumberFilter(row.daysExceeded, query.daysExceeded)) return false;
      if (query.penalCharges && !matchesExportNumberFilter(row.penalCharges, query.penalCharges)) return false;
      return true;
    });
    const sheet: SimpleXlsxCell[][] = [
      [...TRANSACTION_REPORT_HEADERS],
      ...rows.map((row) => [
        row.transactionId,
        row.applicationNumber,
        row.fullName,
        row.mobileNumber,
        row.email,
        toExcelDate(row.dateOfBirth),
        row.panNumber,
        toExcelDate(row.disbursedAt),
        toExcelNumber(row.disbursedAmount),
        toExcelNumber(row.interestReceived),
        toExcelNumber(row.interestRate),
        toExcelNumber(row.processingFeePercent),
        toExcelNumber(row.processingFeeAmount),
        toExcelNumber(row.gstOnPfPercent),
        toExcelNumber(row.gstAmount),
        toExcelDate(row.dueDate),
        toExcelDate(row.repaymentAt),
        row.daysExceeded,
        toExcelNumber(row.penalCharges),
      ]),
    ];
    return buildSimpleXlsxWorkbook(sheet, 'Transaction report');
  }
}
