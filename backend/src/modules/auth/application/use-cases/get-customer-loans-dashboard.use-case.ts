import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { APPLICATION_STATUS } from '../../../../common/constants/application.constants';
import { computeFeeAmountsFromLoanDetail } from '../../../../common/loan/loan-disbursement-view.util';
import type {
  CustomerLoanCard,
  CustomerLoanRepaymentLine,
  CustomerLoansDashboardResult,
} from '../contracts/customer-loans-dashboard.contract';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { PrismaService } from '../../../../prisma/prisma.service';

function isTerminalApplicationStatus(statusName: string): boolean {
  return (
    statusName === APPLICATION_STATUS.REJECTED || statusName === APPLICATION_STATUS.KYC_FAILED
  );
}

function decToAmountString(value: Prisma.Decimal | null | undefined): string | null {
  if (value == null) return null;
  const n = value.toNumber();
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

function isoDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function maskBank(bankName: string | null | undefined, accountNumber: string | null | undefined): string | null {
  const bank = bankName?.trim();
  const tail = accountNumber?.replace(/\D/g, '').slice(-4);
  if (bank && tail) return `${bank} ••••${tail}`;
  if (bank) return bank;
  if (tail) return `Account ••••${tail}`;
  return null;
}

function isDisbursedRow(disbursedAt: Date | null | undefined, statusName: string): boolean {
  return disbursedAt != null || statusName === APPLICATION_STATUS.DISBURSED;
}

function mapRow(r: {
  uuid: string;
  applicationStatus: { name: string };
  details: {
    selectedLoanAmount: Prisma.Decimal | null;
    expectedRepaymentDays: number | null;
    expectedRepaymentDate: Date | null;
    bankAccountNumber: string | null;
    bankName: string | null;
    interestRate: Prisma.Decimal | null;
    processingFeePercentage: Prisma.Decimal | null;
    gstPercentage: Prisma.Decimal | null;
  } | null;
  loanAccount: {
    principalAmount: Prisma.Decimal;
    totalRepaymentAmount: Prisma.Decimal;
    loanMaturityDate: Date;
    disbursedAt: Date;
    bankAccountNumber: string | null;
  } | null;
}): CustomerLoanCard {
  const loanDetail = r.details;
  const loanAccount = r.loanAccount;
  const fees = computeFeeAmountsFromLoanDetail(loanDetail);

  return {
    applicationUuid: r.uuid,
    status: r.applicationStatus.name,
    loanAmount: loanAccount
      ? decToAmountString(loanAccount.principalAmount)
      : decToAmountString(loanDetail?.selectedLoanAmount ?? null),
    tenureDays: loanDetail?.expectedRepaymentDays ?? null,
    interestAmount: fees.interestAmount != null ? fees.interestAmount.toFixed(2) : null,
    processingFeeAmount: fees.processingFeeAmount != null ? fees.processingFeeAmount.toFixed(2) : null,
    gstAmount: fees.gstAmount != null ? fees.gstAmount.toFixed(2) : null,
    totalRepayment: loanAccount
      ? decToAmountString(loanAccount.totalRepaymentAmount)
      : fees.repaymentAmount != null
        ? fees.repaymentAmount.toFixed(2)
        : null,
    maturityDate: loanAccount
      ? isoDateOnly(loanAccount.loanMaturityDate)
      : isoDateOnly(loanDetail?.expectedRepaymentDate ?? null),
    disbursedAt: loanAccount ? loanAccount.disbursedAt.toISOString() : null,
    bankDisplay: maskBank(
      loanDetail?.bankName ?? null,
      loanAccount?.bankAccountNumber ?? loanDetail?.bankAccountNumber ?? null,
    ),
  };
}

@Injectable()
export class GetCustomerLoansDashboardUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly prisma: PrismaService
  ) {}

  async execute(req: Request): Promise<CustomerLoansDashboardResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const rows = await this.prisma.client.application.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      select: {
        uuid: true,
        applicationStatus: { select: { name: true } },
        details: {
          select: {
            selectedLoanAmount: true,
            expectedRepaymentDays: true,
            expectedRepaymentDate: true,
            bankAccountNumber: true,
            ifscCode: true,
            bankName: true,
            interestRate: true,
            processingFeePercentage: true,
            gstPercentage: true,
          },
        },
        loanAccount: {
          select: {
            principalAmount: true,
            totalRepaymentAmount: true,
            loanMaturityDate: true,
            disbursedAt: true,
            bankAccountNumber: true,
          },
        },
      },
    });

    const todayStart = startOfTodayUtc();
    const cards = rows.map(mapRow);

    const maturityFor = (raw: (typeof rows)[number]) =>
      raw.loanAccount?.loanMaturityDate ?? raw.details?.expectedRepaymentDate ?? null;

    const disbursedAtFor = (raw: (typeof rows)[number]) => raw.loanAccount?.disbursedAt ?? null;

    const activeIndices = rows
      .map((raw, i) => ({ raw, i }))
      .filter(({ raw }) => {
        if (isTerminalApplicationStatus(raw.applicationStatus.name)) return false;
        const maturity = maturityFor(raw);
        if (!maturity) return false;
        const maturityStart = new Date(
          Date.UTC(maturity.getUTCFullYear(), maturity.getUTCMonth(), maturity.getUTCDate())
        );
        const disbursed = isDisbursedRow(disbursedAtFor(raw), raw.applicationStatus.name);
        return disbursed && maturityStart >= todayStart;
      })
      .sort((a, b) => {
        const da = disbursedAtFor(a.raw)?.getTime() ?? 0;
        const db = disbursedAtFor(b.raw)?.getTime() ?? 0;
        return db - da;
      })
      .map(({ i }) => i);

    const activeLoans = activeIndices.map((i) => cards[i]);

    const pastLoans = cards.filter((c, i) => {
      const raw = rows[i];
      const status = raw.applicationStatus.name;
      if (isTerminalApplicationStatus(status)) return true;
      const maturity = maturityFor(raw);
      if (!maturity) return false;
      const maturityStart = new Date(
        Date.UTC(maturity.getUTCFullYear(), maturity.getUTCMonth(), maturity.getUTCDate())
      );
      const disbursed = isDisbursedRow(disbursedAtFor(raw), status);
      return disbursed && maturityStart < todayStart;
    });

    const isActiveRow = (raw: (typeof rows)[number]): boolean => {
      if (isTerminalApplicationStatus(raw.applicationStatus.name)) return false;
      const maturity = maturityFor(raw);
      if (!maturity) return false;
      const maturityStart = new Date(
        Date.UTC(maturity.getUTCFullYear(), maturity.getUTCMonth(), maturity.getUTCDate())
      );
      const disbursed = isDisbursedRow(disbursedAtFor(raw), raw.applicationStatus.name);
      return disbursed && maturityStart >= todayStart;
    };

    const isPastRow = (raw: (typeof rows)[number]): boolean => {
      if (isTerminalApplicationStatus(raw.applicationStatus.name)) return true;
      const maturity = maturityFor(raw);
      if (!maturity) return false;
      const maturityStart = new Date(
        Date.UTC(maturity.getUTCFullYear(), maturity.getUTCMonth(), maturity.getUTCDate())
      );
      const disbursed = isDisbursedRow(disbursedAtFor(raw), raw.applicationStatus.name);
      return disbursed && maturityStart < todayStart;
    };

    const inProgress = cards.filter((_, i) => {
      const raw = rows[i];
      if (raw.details?.selectedLoanAmount == null) return false;
      if (isActiveRow(raw)) return false;
      if (isPastRow(raw)) return false;
      return true;
    });

    const repaymentSchedule: CustomerLoanRepaymentLine[] = [];
    for (const i of activeIndices) {
      const card = cards[i];
      const raw = rows[i];
      const maturity = maturityFor(raw);
      const total = card.totalRepayment;
      if (maturity && total) {
        const maturityStart = new Date(
          Date.UTC(maturity.getUTCFullYear(), maturity.getUTCMonth(), maturity.getUTCDate())
        );
        let lineStatus: CustomerLoanRepaymentLine['status'] = 'scheduled';
        if (maturityStart < todayStart) lineStatus = 'overdue';
        else if (maturityStart.getTime() === todayStart.getTime()) lineStatus = 'due';
        const suffix = activeLoans.length > 1 ? ` · ${card.applicationUuid.slice(0, 8)}…` : '';
        repaymentSchedule.push({
          dueDate: isoDateOnly(maturity) ?? '',
          label: `Full repayment (principal + interest + fees)${suffix}`,
          amount: total,
          status: lineStatus,
        });
      }
    }

    return {
      activeLoans,
      pastLoans,
      inProgress,
      repaymentSchedule,
    };
  }
}
