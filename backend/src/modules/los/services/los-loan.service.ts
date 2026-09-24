import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { APPLICATION_STATUS } from '../../../common/constants/application.constants';
import { isClosedLoanStatus, LOAN_STATUS } from '../../../common/constants/loan.constants';
import { mapEasebuzzTransferLog } from '../../../common/easebuzz/easebuzz-transfer-log.util';
import { KycFilesService } from '../../../common/kyc/kyc-files.service';
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
import { billDueNowAfterWaiverInr, waivedAmountFromLoan } from '../../../common/loan/loan-charge-waiver.util';
import { resolveEffectiveLoanStatus } from '../../../common/loan/effective-loan-status.util';
import { roundInr2 } from '../../../common/loan/loan-repayment-outstanding.util';
import { isCollectedRepaymentStatus } from '../../../common/constants/loan-repayment.constants';
import { computeFeeAmountsFromLoanDetail } from '../../../common/loan/loan-disbursement-view.util';
import { NocLetterService } from '../../../common/noc/noc-letter.service';
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
    private readonly kycFiles: KycFilesService,
    private readonly nocLetter: NocLetterService,
  ) {}

  async listLoans() {
    const loans = await this.prisma.read.loanAccount.findMany({
      where: {
        application: { lead: { isInternalTesting: false } },
      },
      orderBy: { disbursedAt: 'desc' },
      include: {
        loanStatus: { select: { name: true, displayName: true } },
        waivedByUser: { select: { fullName: true } },
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
                leadDetail: {
                  select: {
                    fullName: true,
                    bureauReport: {
                      select: {
                        cibilCreditAssessment: { select: { category: true } },
                      },
                    },
                  },
                },
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

      // Open: days past due as of today. Closed after due: days from maturity through payoff.
      const daysPastDue = overdueDaysFromMaturity(
        loan.loanMaturityDate,
        loan.closedAt ?? new Date(),
      );
      const overdueDays = daysPastDue > 0 ? Math.max(daysPastDue, 1) : 0;
      const pastDue = loan.closedAt == null && overdueDays > 0;
      const principal = decimalToNumber(loan.principalAmount);
      const dailyRate = decimalToNumber(loan.interestRate);
      const penalAmount =
        principal != null ? computePenalChargeInr(principal, overdueDays, penal) : 0;
      const overdueInterestInr =
        principal != null && dailyRate != null && overdueDays > 0
          ? computeInterestAmountInr(principal, dailyRate, overdueDays)
          : 0;
      const storedWaiverInr = waivedAmountFromLoan(loan.waivedAmount);
      const interestBooked = decimalToNumber(loan.interestAmount);
      const totalRepayment =
        principal != null && interestBooked != null
          ? Math.round((principal + interestBooked) * 100) / 100
          : (decimalToNumber(loan.totalRepaymentAmount) ?? 0);
      const bill = billDueNowAfterWaiverInr({
        amountDueBeforePenal: totalRepayment + overdueInterestInr,
        penalInr: penalAmount,
        overdueInterestInr,
        waivedAmountInr: storedWaiverInr,
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
        cibilCreditAssessmentCategory:
          loan.application.lead.leadDetail?.bureauReport?.cibilCreditAssessment?.category ?? null,
        mobileNumber: loan.customer.mobileNumber,
        email: details?.emailId ?? null,
        principalAmount: loan.principalAmount.toString(),
        netDisbursedAmount: loan.netDisbursedAmount.toString(),
        interestRate: loan.interestRate.toString(),
        interestAmount: interestBooked != null ? interestBooked.toFixed(2) : loan.interestAmount.toString(),
        totalRepaymentAmount: totalRepayment.toFixed(2),
        /** Unused for overdue charges (penal % applies instead); kept for API compatibility. */
        bounceRatePerDayInr: '0.00',
        /** Penal charge (rate % of principal, min/max capped); 0 unless past due and still open. */
        penalAmount: penalAmount.toFixed(2),
        overdueInterestInr: overdueInterestInr.toFixed(2),
        waivedAmountInr: (pastDue ? bill.appliedWaiverInr : storedWaiverInr).toFixed(2),
        waivedByName: loan.waivedByUser?.fullName ?? null,
        waivedAt: loan.waivedAt?.toISOString() ?? null,
        totalRepaymentWithPenalAmount: (
          Math.round((totalRepayment + overdueInterestInr + penalAmount - (pastDue ? bill.appliedWaiverInr : 0)) * 100) / 100
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
        isNocSent: loan.isNocSent === true,
        unsettledPaymentLink: unsettledByLoanId.get(loan.id.toString()) === true,
      };
    });
  }

  async getLoanDetails(loanUuid: string) {
    const loan = await this.prisma.read.loanAccount.findUnique({
      where: { uuid: loanUuid },
      include: {
        loanStatus: { select: { name: true, displayName: true } },
        waivedByUser: { select: { fullName: true } },
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
                    bureauReport: {
                      select: {
                        cibilCreditAssessment: { select: { category: true } },
                      },
                    },
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
      .filter((row) => isCollectedRepaymentStatus(row.status))
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
    // Contractual amount due on the repay date: principal + tenure interest.
    // Closed loans must not use the stored total — settlement used to overwrite it
    // with the amount collected, which folds penal into this figure.
    const amountDueAtMaturity =
      principal != null && interestAtMaturity != null
        ? Math.round((principal + interestAtMaturity) * 100) / 100
        : decimalToNumber(loan.totalRepaymentAmount);

    // Same overdue test as `listLoans`: live days if open, days-at-payoff if closed after due.
    const daysPastDue = overdueDaysFromMaturity(
      loan.loanMaturityDate,
      loan.closedAt ?? new Date(),
    );
    const overdueDays = daysPastDue > 0 ? Math.max(daysPastDue, 1) : 0;
    const penal = await this.bounceChargeTiers.loadPenalConfig();
    const penalAmount =
      principal != null ? computePenalChargeInr(principal, overdueDays, penal) : 0;

    let daysOutstanding: number | null = null;
    let interestTillToday: string | null = null;
    let amountDueToday: string | null = null;
    let usedFullTenureInterest = false;
    let overdueInterestInr =
      principal != null && dailyRate != null && overdueDays > 0
        ? computeInterestAmountInr(principal, dailyRate, overdueDays)
        : 0;
    const storedWaiverInr = waivedAmountFromLoan(loan.waivedAmount);
    let appliedWaiverInr = storedWaiverInr;
    const bounceFeeInr = loan.closedAt == null ? penalAmount.toFixed(2) : null;

    if (loan.closedAt == null && principal != null && dailyRate != null) {
      const coolingPeriodDays = await loadRepayCoolingPeriodDays(this.prisma.client);
      const due = computeAmountDueNowInr(principal, dailyRate, loan.disbursedAt, {
        coolingPeriodDays,
        tenureDays: contractedTenureDays ?? 1,
        overdueDays,
      });
      daysOutstanding = due.daysOutstanding;
      interestTillToday = due.totalInterestAmount.toFixed(2);
      overdueInterestInr = due.overdueInterestAmount;
      const bill = billDueNowAfterWaiverInr({
        amountDueBeforePenal: due.amountDue,
        penalInr: penalAmount,
        overdueInterestInr: due.overdueInterestAmount,
        waivedAmountInr: storedWaiverInr,
      });
      appliedWaiverInr = bill.appliedWaiverInr;
      amountDueToday = bill.billDueNow.toFixed(2);
      usedFullTenureInterest = due.usedFullTenureInterest;
    } else if (loan.closedAt != null) {
      daysOutstanding = calendarDaysBetween(loan.disbursedAt, loan.closedAt) + 1;
      interestTillToday = loan.interestAmount.toFixed(2);
      amountDueToday = (amountDueAtMaturity ?? decimalToNumber(loan.totalRepaymentAmount) ?? 0).toFixed(2);
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
      cibilCreditAssessmentCategory: profile?.bureauReport?.cibilCreditAssessment?.category ?? null,
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
      overdueInterestInr: overdueInterestInr.toFixed(2),
      waivedAmountInr: (loan.closedAt != null ? storedWaiverInr : appliedWaiverInr).toFixed(2),
      waivedByName: loan.waivedByUser?.fullName ?? null,
      waivedAt: loan.waivedAt?.toISOString() ?? null,
      totalRepaymentWithPenalAmount: (
        Math.round((bookedTotal + overdueInterestInr + penalAmount - (loan.closedAt != null ? 0 : appliedWaiverInr)) * 100) / 100
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
      isNocSent: loan.isNocSent === true,
      nocSentAt: loan.nocSentAt?.toISOString() ?? null,
      nocLetterNumber: loan.nocLetterNumber ?? null,
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
        status:
          row.status === 'FAILED'
            ? 'FAILED'
            : row.status === 'PARTIAL'
              ? 'PARTIAL'
              : 'SUCCESS',
        utr: row.utr,
        failureMessage: row.failure_message,
        paidAt: row.paid_at.toISOString(),
        createdAt: row.created_at.toISOString(),
      })),
    };
  }

  async waiveCharges(loanUuid: string, waivedAmountInr: number, userId: string) {
    const waived = roundInr2(waivedAmountInr);
    if (!Number.isFinite(waived) || waived < 0) {
      throw new BadRequestException('Enter a waiver amount of ₹0 or more.');
    }

    const loan = await this.prisma.client.loanAccount.findUnique({
      where: { uuid: loanUuid },
      select: {
        id: true,
        uuid: true,
        closedAt: true,
        principalAmount: true,
        interestRate: true,
        disbursedAt: true,
        loanMaturityDate: true,
        loanStatus: { select: { name: true, displayName: true } },
      },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found.');
    }
    if (loan.closedAt != null || isClosedLoanStatus(loan.loanStatus.name)) {
      throw new BadRequestException('This loan is already closed.');
    }

    const effectiveStatus = resolveEffectiveLoanStatus({
      statusName: loan.loanStatus.name,
      statusDisplayName: loan.loanStatus.displayName,
      loanMaturityDate: loan.loanMaturityDate,
      closedAt: loan.closedAt,
    });
    const pastDue = effectiveStatus.code === LOAN_STATUS.OVERDUE;
    const overdueDays = pastDue
      ? Math.max(overdueDaysFromMaturity(loan.loanMaturityDate), 1)
      : 0;
    const principal = decimalToNumber(loan.principalAmount);
    const dailyRate = decimalToNumber(loan.interestRate);
    if (principal == null || dailyRate == null) {
      throw new BadRequestException('Unable to compute overdue charges for this loan.');
    }
    const penal = await this.bounceChargeTiers.loadPenalConfig();
    const penalAmount = computePenalChargeInr(principal, overdueDays, penal);
    const overdueInterestInr =
      overdueDays > 0 ? computeInterestAmountInr(principal, dailyRate, overdueDays) : 0;
    const maxWaiver = roundInr2(penalAmount + overdueInterestInr);
    if (waived > maxWaiver + 0.009) {
      throw new BadRequestException(
        `Waiver cannot exceed penal + overdue interest (₹${maxWaiver.toFixed(2)}).`,
      );
    }

    let waivedByUserId: bigint | null = null;
    try {
      waivedByUserId = waived > 0.009 ? BigInt(userId) : null;
    } catch {
      throw new BadRequestException('Signed-in LOS user is invalid.');
    }

    const now = new Date();
    await this.prisma.client.loanAccount.update({
      where: { id: loan.id },
      data:
        waived > 0.009
          ? {
              waivedAmount: waived.toFixed(2),
              waivedByUserId,
              waivedAt: now,
            }
          : {
              waivedAmount: '0.00',
              waivedByUserId: null,
              waivedAt: null,
            },
    });

    return this.getLoanDetails(loan.uuid);
  }

  async serveNocPdf(loanUuid: string, res: Response): Promise<void> {
    const loan = await this.prisma.read.loanAccount.findUnique({
      where: { uuid: loanUuid },
      select: {
        isNocSent: true,
        nocPdfRelativePath: true,
        nocLetterNumber: true,
        loanNumber: true,
      },
    });
    if (!loan) throw new NotFoundException('Loan not found.');
    const rel = loan.nocPdfRelativePath?.trim() ?? '';
    if (!loan.isNocSent || !rel) {
      throw new NotFoundException('NOC letter has not been sent yet.');
    }
    let buf: Buffer;
    try {
      buf = await this.kycFiles.readBytes(rel);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NoSuchKey') || msg.includes('S3 GET failed (404)')) {
        throw new NotFoundException('NOC letter file is missing from storage.');
      }
      throw err;
    }
    const fileName = `NOC-${loan.nocLetterNumber ?? loan.loanNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buf);
  }

  /**
   * Generate + store + email NOC for a fully repaid loan that has not been sent yet.
   * Idempotent when already sent — returns current loan details.
   */
  async sendNocLetter(loanUuid: string) {
    const loan = await this.prisma.read.loanAccount.findUnique({
      where: { uuid: loanUuid },
      select: {
        id: true,
        uuid: true,
        closedAt: true,
        isNocSent: true,
        loanStatus: { select: { name: true } },
      },
    });
    if (!loan) throw new NotFoundException('Loan not found.');

    const status = (loan.loanStatus.name ?? '').toUpperCase();
    if (status === LOAN_STATUS.WRITTEN_OFF) {
      throw new BadRequestException('NOC is not available for written-off loans.');
    }
    if (loan.closedAt == null) {
      throw new BadRequestException('NOC can only be sent after the loan is fully repaid.');
    }

    if (!loan.isNocSent) {
      const ok = await this.nocLetter.issueIfNeeded(loan.id);
      if (!ok) {
        throw new BadRequestException(
          'Failed to generate or send the NOC letter. Check email/S3 configuration and server logs.',
        );
      }
    }

    return this.getLoanDetails(loan.uuid);
  }

  private resolveLoanNumber(loan: { loanAccountNumber: string } & Record<string, unknown>): string {
    const raw = loan['loanNumber'];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    return loan.loanAccountNumber;
  }
}
