import { Injectable, NotFoundException } from '@nestjs/common';
import { APPLICATION_STATUS } from '../../../common/constants/application.constants';
import { LOAN_STATUS } from '../../../common/constants/loan.constants';
import { mapEasebuzzTransferLog } from '../../../common/easebuzz/easebuzz-transfer-log.util';
import {
  calendarDaysBetween,
  computeAmountDueNowInr,
  decimalToNumber,
} from '../../../common/loan/loan-calculation.util';
import { isRepaymentPastDue } from '../../../common/loan/bounce-charge.util';
import { BounceChargeTierResolverService } from '../../../common/loan/bounce-charge-tier.resolver';
import { resolveEffectiveLoanStatus } from '../../../common/loan/effective-loan-status.util';
import { computeFeeAmountsFromLoanDetail } from '../../../common/loan/loan-disbursement-view.util';
import { formatLosPersonName } from '../format-los-person-name';
import { PrismaService } from '../../../prisma/prisma.service';

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
  ) {}

  async listLoans() {
    const loans = await this.prisma.client.loanAccount.findMany({
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
                uuid: true,
                leadDetail: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });

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
      };
    });
  }

  async getLoanDetails(loanUuid: string) {
    const loan = await this.prisma.client.loanAccount.findUnique({
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
      const gatewayRows = await this.prisma.client.$queryRaw<
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

    const repaymentRows = await this.prisma.client.$queryRaw<
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maturity = new Date(loan.loanMaturityDate);
    maturity.setHours(0, 0, 0, 0);
    const daysToMaturity = Math.round((maturity.getTime() - today.getTime()) / 86_400_000);
    const totalPaid = repaymentRows
      .filter((row) => row.status === 'SUCCESS')
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const outstanding =
      loan.closedAt != null
        ? 0
        : Math.max(Number(loan.totalRepaymentAmount) - totalPaid, 0);

    const principal = decimalToNumber(loan.principalAmount);
    const dailyRate = decimalToNumber(loan.interestRate);
    let daysOutstanding: number | null = null;
    let interestTillToday: string | null = null;
    let amountDueToday: string | null = null;
    let bounceFeeInr: string | null = null;

    if (loan.closedAt == null && principal != null && dailyRate != null) {
      const due = computeAmountDueNowInr(principal, dailyRate, loan.disbursedAt);
      daysOutstanding = due.daysOutstanding;
      interestTillToday = due.interestAmount.toFixed(2);
      const pastDue =
        loan.loanStatus.name === LOAN_STATUS.OVERDUE || isRepaymentPastDue(loan.loanMaturityDate);
      const bounce = pastDue
        ? await this.bounceChargeTiers.resolveFeeForAmount(principal)
        : 0;
      bounceFeeInr = bounce.toFixed(2);
      amountDueToday = (Math.round((due.amountDue + bounce) * 100) / 100).toFixed(2);
    } else if (loan.closedAt != null) {
      daysOutstanding = calendarDaysBetween(loan.disbursedAt, loan.closedAt) + 1;
      interestTillToday = loan.interestAmount.toFixed(2);
      amountDueToday = loan.totalRepaymentAmount.toFixed(2);
    }

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
      interestAmount: loan.interestAmount.toString(),
      totalRepaymentAmount: loan.totalRepaymentAmount.toString(),
      processingFeeAmount: fees.processingFeeAmount != null ? fees.processingFeeAmount.toFixed(2) : null,
      gstAmount: fees.gstAmount != null ? fees.gstAmount.toFixed(2) : null,
      processingFeePercentage: details?.processingFeePercentage?.toString() ?? null,
      gstPercentage: details?.gstPercentage?.toString() ?? null,
      expectedRepaymentDays: details?.expectedRepaymentDays ?? null,
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
      bounceFeeInr,
      isDisbursedApplication: loan.application.applicationStatus.name === APPLICATION_STATUS.DISBURSED,
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
