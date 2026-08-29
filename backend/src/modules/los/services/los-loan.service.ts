import { Injectable, NotFoundException } from '@nestjs/common';
import { APPLICATION_STATUS } from '../../../common/constants/application.constants';
import { LOAN_STATUS } from '../../../common/constants/loan.constants';
import { mapEasebuzzTransferLog } from '../../../common/easebuzz/easebuzz-transfer-log.util';
import {
  calendarDaysBetween,
  computeAmountDueNowInr,
  computeInterestAmountInr,
  resolveContractedTenureDays,
  decimalToNumber,
} from '../../../common/loan/loan-calculation.util';
import { loadRepayCoolingPeriodDays } from '../../../common/loan/repay-cooling-period.util';
import {
  computePenalChargeInr,
  daysToMaturityIst,
  overdueDaysFromMaturity,
} from '../../../common/loan/bounce-charge.util';
import { BounceChargeTierResolverService } from '../../../common/loan/bounce-charge-tier.resolver';
import { resolveEffectiveLoanStatus } from '../../../common/loan/effective-loan-status.util';
import { computeFeeAmountsFromLoanDetail } from '../../../common/loan/loan-disbursement-view.util';
import { formatLosPersonName } from '../format-los-person-name';
import { PrismaService } from '../../../prisma/prisma.service';
import { LosLoanRepaymentSyncService } from './los-loan-repayment-sync.service';

function displayName(name: string, displayNameValue: string | null | undefined): string {
  return displayNameValue?.trim() || name;
}

function maskAccountNumber(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.length <= 4) return raw;
  return `${'*'.repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
}

@Injectable()
export class LosLoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bounceChargeTiers: BounceChargeTierResolverService,
    private readonly repaymentSync: LosLoanRepaymentSyncService,
  ) {}

  async listLoans() {
    const loans = await this.prisma.read.loanAccount.findMany({
      where: {
        application: { lead: { isInternalTesting: false } },
      },
      orderBy: { disbursedAt: 'desc' },
      take: 500,
      include: {
        loanStatus: { select: { name: true, displayName: true } },
        customer: { select: { uuid: true, mobileNumber: true } },
        application: {
          select: {
            uuid: true,
            applicationNumber: true,
            applicationStatus: { select: { name: true, displayName: true } },
            details: {
              select: {
                emailId: true,
                bankName: true,
                bankAccountNumber: true,
                ifscCode: true,
                selectedLoanAmount: true,
                processingFeePercentage: true,
                gstPercentage: true,
                interestRate: true,
                expectedRepaymentDays: true,
              },
            },
            lead: {
              select: {
                id: true,
                uuid: true,
                leadDetail: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });

    const penal = await this.bounceChargeTiers.loadPenalConfig();
    const unsettledByLoanId = await this.repaymentSync.unsettledFlagsByLoanId(loans);

    return loans.map((loan) => {
      const details = loan.application.details;
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
      const loanNumber = this.resolveLoanNumber(loan);
      const effectiveStatus = resolveEffectiveLoanStatus({
        statusName: loan.loanStatus.name,
        statusDisplayName: loan.loanStatus.displayName,
        loanMaturityDate: loan.loanMaturityDate,
        closedAt: loan.closedAt,
      });

      // A closed loan keeps its stored status, so exclude it explicitly before charging penalty.
      const pastDue = loan.closedAt == null && effectiveStatus.code === LOAN_STATUS.OVERDUE;
      const overdueDays = pastDue
        ? Math.max(overdueDaysFromMaturity(loan.loanMaturityDate), 1)
        : 0;
      const principal = decimalToNumber(loan.principalAmount);
      const penalAmount =
        principal != null ? computePenalChargeInr(principal, overdueDays, penal) : 0;
      const totalRepayment = decimalToNumber(loan.totalRepaymentAmount) ?? 0;

      return {
        uuid: loan.uuid,
        loanNumber,
        loanAccountNumber: loan.loanAccountNumber,
        applicationUuid: loan.application.uuid,
        applicationNumber: loan.application.applicationNumber,
        customerUuid: loan.customer.uuid,
        leadUuid: loan.application.lead.uuid,
        fullName: formatLosPersonName(loan.application.lead.leadDetail?.fullName),
        mobileNumber: loan.customer.mobileNumber,
        email: details?.emailId ?? null,
        principalAmount: loan.principalAmount.toString(),
        netDisbursedAmount: loan.netDisbursedAmount.toString(),
        interestRate: loan.interestRate.toString(),
        interestAmount: loan.interestAmount.toString(),
        totalRepaymentAmount: loan.totalRepaymentAmount.toString(),
        /** Unused for overdue charges (penal % applies instead); kept for API compatibility. */
        bounceRatePerDayInr: '0.00',
        /** Penal charge (rate % of principal, min/max capped); 0 unless past due and still open. */
        penalAmount: penalAmount.toFixed(2),
        totalRepaymentWithPenalAmount: (
          Math.round((totalRepayment + penalAmount) * 100) / 100
        ).toFixed(2),
        /** IST calendar days past maturity; 0 when not overdue. */
        overdueDays,
        processingFeeAmount: fees.processingFeeAmount != null ? fees.processingFeeAmount.toFixed(2) : null,
        gstAmount: fees.gstAmount != null ? fees.gstAmount.toFixed(2) : null,
        disbursedAt: loan.disbursedAt.toISOString(),
        loanMaturityDate: loan.loanMaturityDate.toISOString().slice(0, 10),
        utr: loan.utr,
        bankName: details?.bankName ?? null,
        bankAccountMasked: maskAccountNumber(loan.bankAccountNumber ?? details?.bankAccountNumber),
        ifscCode: loan.ifscCode ?? details?.ifscCode ?? null,
        loanStatusCode: effectiveStatus.code,
        loanStatusLabel: effectiveStatus.label,
        applicationStatusCode: loan.application.applicationStatus.name,
        applicationStatusLabel: displayName(
          loan.application.applicationStatus.name,
          loan.application.applicationStatus.displayName,
        ),
        closedAt: loan.closedAt?.toISOString() ?? null,
        unsettledPaymentLink: unsettledByLoanId.get(loan.id.toString()) === true,
      };
    });
  }

  async getLoanDetails(loanUuid: string) {
    const loan = await this.prisma.read.loanAccount.findUnique({
      where: { uuid: loanUuid },
      include: {
        loanStatus: { select: { name: true, displayName: true } },
        customer: { select: { uuid: true, mobileNumber: true } },
        application: {
          select: {
            uuid: true,
            applicationNumber: true,
            applicationStatus: { select: { name: true, displayName: true } },
            details: {
              select: {
                emailId: true,
                bankName: true,
                bankAccountNumber: true,
                ifscCode: true,
                selectedLoanAmount: true,
                processingFeePercentage: true,
                gstPercentage: true,
                interestRate: true,
                expectedRepaymentDays: true,
                expectedRepaymentDate: true,
                loanDocumentsAcceptedAt: true,
                keyFactPdfRelativePath: true,
                reasonForLoan: { select: { name: true } },
              },
            },
            lead: {
              select: {
                id: true,
                uuid: true,
                leadDetail: {
                  select: {
                    fullName: true,
                    panNumber: true,
                    addressLine1: true,
                    addressLine2: true,
                    pincode: true,
                    city: { select: { name: true, state: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found.');
    }

    let gatewayTransferJson: unknown = (loan as { gatewayTransferJson?: unknown }).gatewayTransferJson ?? null;
    try {
      const gatewayRows = await this.prisma.read.$queryRaw<
        Array<{ gateway_transfer_json: unknown }>
      >`
        SELECT gateway_transfer_json
        FROM loan_account
        WHERE id = ${loan.id}
        LIMIT 1
      `;
      if (gatewayRows[0] && 'gateway_transfer_json' in gatewayRows[0]) {
        gatewayTransferJson = gatewayRows[0].gateway_transfer_json;
      }
    } catch {
      // Column may not exist until migration is applied; loan detail still loads.
    }

    const repaymentRows = await this.prisma.read.$queryRaw<
      Array<{
        uuid: string;
        amount: string | number;
        payment_mode: string;
        status: string;
        utr: string | null;
        failure_message: string | null;
        paid_at: Date;
        created_at: Date;
      }>
    >`
      SELECT uuid, amount, payment_mode, status, utr, failure_message, paid_at, created_at
      FROM loan_repayment
      WHERE loan_account_id = ${loan.id}
      ORDER BY paid_at DESC
    `;

    const details = loan.application.details;
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
      { preferStoredTenure: true },
    );
    const profile = loan.application.lead.leadDetail;
    const loanNumber = this.resolveLoanNumber(loan);
    const effectiveStatus = resolveEffectiveLoanStatus({
      statusName: loan.loanStatus.name,
      statusDisplayName: loan.loanStatus.displayName,
      loanMaturityDate: loan.loanMaturityDate,
      closedAt: loan.closedAt,
    });
    // IST, so this stays the exact negation of `overdueDays` on a UTC-clocked server.
    const daysToMaturity = daysToMaturityIst(loan.loanMaturityDate);
    const totalPaid = repaymentRows
      .filter((row) => row.status === 'SUCCESS')
      .reduce((sum, row) => sum + Number(row.amount), 0);

    const principal = decimalToNumber(loan.principalAmount);
    const dailyRate = decimalToNumber(loan.interestRate);
    const contractedTenureDays = resolveContractedTenureDays({
      disbursedAt: loan.disbursedAt,
      maturityDate: loan.loanMaturityDate,
      expectedRepaymentDate: details?.expectedRepaymentDate,
      storedDays: details?.expectedRepaymentDays,
    });
    const interestAtMaturity =
      loan.closedAt != null
        ? decimalToNumber(loan.interestAmount)
        : principal != null && dailyRate != null && contractedTenureDays != null
          ? computeInterestAmountInr(principal, dailyRate, contractedTenureDays)
          : decimalToNumber(loan.interestAmount);
    const amountDueAtMaturity =
      loan.closedAt != null
        ? decimalToNumber(loan.totalRepaymentAmount)
        : principal != null && interestAtMaturity != null
          ? Math.round((principal + interestAtMaturity) * 100) / 100
          : decimalToNumber(loan.totalRepaymentAmount);

    // Same overdue test as `listLoans`, so the list and this page can never disagree.
    const pastDue = loan.closedAt == null && effectiveStatus.code === LOAN_STATUS.OVERDUE;
    const overdueDays = pastDue
      ? Math.max(overdueDaysFromMaturity(loan.loanMaturityDate), 1)
      : 0;
    const penal = await this.bounceChargeTiers.loadPenalConfig();
    const penalAmount =
      principal != null ? computePenalChargeInr(principal, overdueDays, penal) : 0;

    let daysOutstanding: number | null = null;
    let interestTillToday: string | null = null;
    let amountDueToday: string | null = null;
    let usedFullTenureInterest = false;
    const bounceFeeInr = loan.closedAt == null ? penalAmount.toFixed(2) : null;

    if (loan.closedAt == null && principal != null && dailyRate != null) {
      const coolingPeriodDays = await loadRepayCoolingPeriodDays(this.prisma.client);
      const due = computeAmountDueNowInr(principal, dailyRate, loan.disbursedAt, {
        coolingPeriodDays,
        tenureDays: contractedTenureDays ?? 1,
      });
      daysOutstanding = due.daysOutstanding;
      interestTillToday = due.interestAmount.toFixed(2);
      amountDueToday = (Math.round((due.amountDue + penalAmount) * 100) / 100).toFixed(2);
      usedFullTenureInterest = due.usedFullTenureInterest;
    } else if (loan.closedAt != null) {
      daysOutstanding = calendarDaysBetween(loan.disbursedAt, loan.closedAt) + 1;
      interestTillToday = loan.interestAmount.toFixed(2);
      amountDueToday = loan.totalRepaymentAmount.toFixed(2);
    }

    const bookedTotal = amountDueAtMaturity ?? decimalToNumber(loan.totalRepaymentAmount) ?? 0;
    const liveBill =
      amountDueToday != null ? Number.parseFloat(amountDueToday) : bookedTotal + penalAmount;
    const outstanding =
      loan.closedAt != null ? 0 : Math.max(Math.round((liveBill - totalPaid) * 100) / 100, 0);

    return {
      uuid: loan.uuid,
      loanNumber,
      loanAccountNumber: loan.loanAccountNumber,
      applicationUuid: loan.application.uuid,
      applicationNumber: loan.application.applicationNumber,
      customerUuid: loan.customer.uuid,
      leadUuid: loan.application.lead.uuid,
      fullName: formatLosPersonName(profile?.fullName),
      mobileNumber: loan.customer.mobileNumber,
      email: details?.emailId ?? null,
      panNumber: profile?.panNumber ?? null,
      address: [profile?.addressLine1, profile?.addressLine2, profile?.city?.name, profile?.city?.state?.name, profile?.pincode]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', ') || null,
      purposeOfLoan: details?.reasonForLoan?.name ?? null,
      principalAmount: loan.principalAmount.toString(),
      netDisbursedAmount: loan.netDisbursedAmount.toString(),
      interestRate: loan.interestRate.toString(),
      interestAmount:
        interestAtMaturity != null ? interestAtMaturity.toFixed(2) : loan.interestAmount.toString(),
      totalRepaymentAmount:
        amountDueAtMaturity != null
          ? amountDueAtMaturity.toFixed(2)
          : loan.totalRepaymentAmount.toString(),
      bounceRatePerDayInr: '0.00',
      penalAmount: penalAmount.toFixed(2),
      totalRepaymentWithPenalAmount: (
        Math.round((bookedTotal + penalAmount) * 100) / 100
      ).toFixed(2),
      overdueDays,
      processingFeeAmount: fees.processingFeeAmount != null ? fees.processingFeeAmount.toFixed(2) : null,
      gstAmount: fees.gstAmount != null ? fees.gstAmount.toFixed(2) : null,
      processingFeePercentage: details?.processingFeePercentage?.toString() ?? null,
      gstPercentage: details?.gstPercentage?.toString() ?? null,
      expectedRepaymentDays: contractedTenureDays,
      disbursedAt: loan.disbursedAt.toISOString(),
      loanMaturityDate: loan.loanMaturityDate.toISOString().slice(0, 10),
      daysToMaturity,
      utr: loan.utr,
      disbursementTransfer: mapEasebuzzTransferLog(gatewayTransferJson),
      bankName: details?.bankName ?? null,
      bankAccountNumber: loan.bankAccountNumber ?? details?.bankAccountNumber ?? null,
      bankAccountMasked: maskAccountNumber(loan.bankAccountNumber ?? details?.bankAccountNumber),
      ifscCode: loan.ifscCode ?? details?.ifscCode ?? null,
      loanStatusCode: effectiveStatus.code,
      loanStatusLabel: effectiveStatus.label,
      applicationStatusCode: loan.application.applicationStatus.name,
      applicationStatusLabel: displayName(
        loan.application.applicationStatus.name,
        loan.application.applicationStatus.displayName,
      ),
      loanDocumentsAcceptedAt: details?.loanDocumentsAcceptedAt?.toISOString() ?? null,
      keyFactReady: Boolean(details?.keyFactPdfRelativePath?.trim()),
      closedAt: loan.closedAt?.toISOString() ?? null,
      totalPaidAmount: totalPaid.toFixed(2),
      outstandingAmount: outstanding.toFixed(2),
      daysOutstanding,
      interestTillToday,
      amountDueToday,
      usedFullTenureInterest,
      bounceFeeInr,
      isDisbursedApplication: loan.application.applicationStatus.name === APPLICATION_STATUS.DISBURSED,
      unsettledPaymentLink: await this.repaymentSync.hasUnsettledPaymentLink({
        loanId: loan.id,
        loanUuid: loan.uuid,
        loanNumber,
        leadId: loan.application.lead.id,
        closedAt: loan.closedAt,
      }),
      repayments: repaymentRows.map((row) => ({
        uuid: row.uuid,
        amount: Number(row.amount).toFixed(2),
        paymentMode: row.payment_mode,
        status: row.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
        utr: row.utr,
        failureMessage: row.failure_message,
        paidAt: row.paid_at.toISOString(),
        createdAt: row.created_at.toISOString(),
      })),
    };
  }

  private resolveLoanNumber(loan: { loanAccountNumber: string } & Record<string, unknown>): string {
    const raw = loan['loanNumber'];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    return loan.loanAccountNumber;
  }
}
