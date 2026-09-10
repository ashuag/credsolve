import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { LOAN_REPAYMENT_STATUS } from '../../../../common/constants/loan-repayment.constants';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';

export type CustomerPaymentHistoryItem = {
  uuid: string;
  loanAccountUuid: string;
  loanNumber: string;
  amount: string;
  paymentMode: string;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  utr: string | null;
  failureMessage: string | null;
  paidAt: string;
};

export type CustomerPaymentHistoryResult = {
  payments: CustomerPaymentHistoryItem[];
};

@Injectable()
export class GetCustomerPaymentHistoryUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(req: Request): Promise<CustomerPaymentHistoryResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    // Raw query so local Prisma client works before regenerate includes status columns.
    const rows = await this.prisma.client.$queryRaw<
      Array<{
        uuid: string;
        loan_uuid: string;
        loan_number: string;
        amount: string | number | { toString(): string };
        payment_mode: string;
        status: string;
        utr: string | null;
        failure_message: string | null;
        paid_at: Date;
      }>
    >`
      SELECT
        r.uuid,
        la.uuid AS loan_uuid,
        la.loan_number,
        r.amount,
        r.payment_mode,
        r.status,
        r.utr,
        r.failure_message,
        r.paid_at
      FROM loan_repayment r
      INNER JOIN loan_account la ON la.id = r.loan_account_id
      WHERE la.customer_id = ${customer.id}
      ORDER BY r.paid_at DESC
      LIMIT 100
    `;

    return {
      payments: rows.map((row) => ({
        uuid: row.uuid,
        loanAccountUuid: row.loan_uuid,
        loanNumber: row.loan_number,
        amount: Number(row.amount).toFixed(2),
        paymentMode: row.payment_mode,
        status:
          row.status === LOAN_REPAYMENT_STATUS.FAILED
            ? LOAN_REPAYMENT_STATUS.FAILED
            : row.status === LOAN_REPAYMENT_STATUS.PARTIAL
              ? LOAN_REPAYMENT_STATUS.PARTIAL
              : LOAN_REPAYMENT_STATUS.SUCCESS,
        utr: row.utr,
        failureMessage: row.failure_message,
        paidAt: row.paid_at.toISOString(),
      })),
    };
  }
}
