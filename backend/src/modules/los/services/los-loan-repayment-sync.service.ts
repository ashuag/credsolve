import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LOAN_REPAYMENT_STATUS } from '../../../common/constants/loan-repayment.constants';
import { LOAN_STATUS } from '../../../common/constants/loan.constants';
import { EasebuzzWireService } from '../../../common/easebuzz/easebuzz-wire.service';
import {
  amountsMatchInr,
  clearPendingRepayIntent,
  forgetLoanRepayTxnid,
  keepLatestPendingLoanTxnid,
  listLoanRepayTxnids,
  loadPendingRepayIntent,
} from '../../../common/easebuzz/repay-intent.util';
import { SettleEasebuzzRepaymentService } from '../../../common/easebuzz/settle-easebuzz-repayment.service';
import { resolveEffectiveLoanStatus } from '../../../common/loan/effective-loan-status.util';
import { RedisService } from '../../../common/redis/redis.service';
import { PrismaService } from '../../../prisma/prisma.service';

const MAX_STATUS_TXNIDS = 8;
const PENDING_STATUSES = new Set(['pending', 'initiated', 'inprogress', 'in_progress', 'queued']);
const TERMINAL_UNPAID_STATUSES = new Set([
  'failure',
  'failed',
  'usercancelled',
  'user_cancelled',
  'cancelled',
  'canceled',
  'bounced',
  'dropped',
  'expired',
]);

export type RefreshPaymentScope = 'pending' | 'all';

export type LosRefreshPaymentAttempt = {
  txnid: string;
  status: string | null;
  amount: string | null;
  ok: boolean;
  alreadySettled: boolean;
  message: string | null;
};

export type LosRefreshPaymentResult = {
  outcome: 'already_closed' | 'no_payment_link' | 'updated' | 'pending' | 'not_paid' | 'retrieve_failed';
  message: string;
  loanClosed: boolean;
  closedAt: string | null;
  loanStatusCode: string;
  loanStatusLabel: string;
  unsettledPaymentLink: boolean;
  settled: Array<{ txnid: string; amount: string | null; status: string | null; closedLoan: boolean }>;
  attempts: LosRefreshPaymentAttempt[];
};

type CandidateTxnid = { txnid: string; amount: string | null };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickPayloadString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function txnidFromPayInitiatePayload(
  payload: unknown,
): { txnid: string; amount: string | null; udf1: string | null } | null {
  const row = asRecord(payload);
  if (!row) return null;
  const txnid = pickPayloadString(row.txnid, row.txnId, row.merchant_txn)?.slice(0, 40) ?? null;
  if (!txnid) return null;
  return {
    txnid,
    amount: pickPayloadString(row.amount),
    udf1: pickPayloadString(row.udf1),
  };
}

/**
 * Finds initiated Easebuzz Pay Now txnids that are not yet SUCCESS, retrieves
 * Transaction V2.1 status, and settles the loan when the vendor reports paid.
 */
@Injectable()
export class LosLoanRepaymentSyncService {
  private readonly logger = new Logger(LosLoanRepaymentSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly easebuzzWire: EasebuzzWireService,
    private readonly settleRepayment: SettleEasebuzzRepaymentService,
  ) {}

  async unsettledFlagsByLoanId(
    loans: Array<{
      id: bigint;
      uuid: string;
      loanNumber: string;
      closedAt: Date | null;
      application: { lead: { id: bigint } };
    }>,
  ): Promise<Map<string, boolean>> {
    const open = loans.filter((loan) => loan.closedAt == null);
    const byId = new Map<string, boolean>();
    if (open.length === 0) return byId;

    const leadIds = [...new Set(open.map((loan) => loan.application.lead.id))];
    const logs = await this.prisma.read.vendorApiLog.findMany({
      where: { leadId: { in: leadIds }, serviceName: { in: ['pay-initiate-link', 'easycollect-create'] } },
      select: { leadId: true, requestPayload: true },
    });

    const loanIds = open.map((loan) => loan.id);
    const successRows = await this.prisma.read.loanRepayment.findMany({
      where: {
        loanAccountId: { in: loanIds },
        status: 'SUCCESS',
        vendorRef: { not: null },
      },
      select: { loanAccountId: true, vendorRef: true },
    });

    const successByLoan = new Map<string, Set<string>>();
    for (const row of successRows) {
      const key = row.loanAccountId.toString();
      const set = successByLoan.get(key) ?? new Set<string>();
      if (row.vendorRef) set.add(row.vendorRef.trim());
      successByLoan.set(key, set);
    }

    const logsByLead = new Map<string, Array<{ txnid: string; udf1: string | null }>>();
    for (const log of logs) {
      if (log.leadId == null) continue;
      const parsed = txnidFromPayInitiatePayload(log.requestPayload);
      if (!parsed) continue;
      const key = log.leadId.toString();
      const list = logsByLead.get(key) ?? [];
      list.push({ txnid: parsed.txnid, udf1: parsed.udf1 });
      logsByLead.set(key, list);
    }

    for (const loan of open) {
      const compact = loan.loanNumber.replace(/[^a-zA-Z0-9_|\/-]/g, '');
      const success = successByLoan.get(loan.id.toString()) ?? new Set<string>();
      const initiated = logsByLead.get(loan.application.lead.id.toString()) ?? [];
      const pending = initiated.some((item) => {
        if (success.has(item.txnid)) return false;
        if (item.udf1 && item.udf1 !== loan.uuid && item.udf1.toUpperCase() !== compact.toUpperCase()) {
          return false;
        }
        if (compact && !item.txnid.startsWith(compact)) return false;
        return true;
      });
      byId.set(loan.id.toString(), pending);
    }

    await Promise.all(
      open.map(async (loan) => {
        const key = loan.id.toString();
        if (byId.get(key)) return;
        const redisIds = await listLoanRepayTxnids(this.redis, loan.uuid);
        if (redisIds.length === 0) return;
        const success = successByLoan.get(key) ?? new Set<string>();
        const compact = loan.loanNumber.replace(/[^a-zA-Z0-9_|\/-]/g, '');
        const pending = redisIds.some(
          (txnid) => !success.has(txnid) && (!compact || txnid.startsWith(compact)),
        );
        if (pending) byId.set(key, true);
      }),
    );

    return byId;
  }

  async hasUnsettledPaymentLink(input: {
    loanId: bigint;
    loanUuid: string;
    loanNumber: string;
    leadId: bigint;
    closedAt: Date | null;
  }): Promise<boolean> {
    if (input.closedAt != null) return false;
    const candidates = await this.collectCandidateTxnids(input, 'pending');
    return candidates.length > 0;
  }

  async refreshPayment(
    loanUuid: string,
    options?: { scope?: RefreshPaymentScope },
  ): Promise<LosRefreshPaymentResult> {
    const scope: RefreshPaymentScope = options?.scope ?? 'all';
    if (scope === 'pending') {
      await keepLatestPendingLoanTxnid(this.redis, loanUuid);
    }
    const loan = await this.prisma.client.loanAccount.findUnique({
      where: { uuid: loanUuid },
      select: {
        id: true,
        uuid: true,
        loanNumber: true,
        principalAmount: true,
        interestRate: true,
        disbursedAt: true,
        loanMaturityDate: true,
        closedAt: true,
        loanStatus: { select: { name: true, displayName: true } },
        application: { select: { uuid: true, leadId: true } },
      },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found.');
    }

    const statusOf = (closedAt: Date | null, name: string, displayName: string | null) =>
      resolveEffectiveLoanStatus({
        statusName: name,
        statusDisplayName: displayName,
        loanMaturityDate: loan.loanMaturityDate,
        closedAt,
      });

    if (loan.closedAt != null || loan.loanStatus.name === LOAN_STATUS.CLOSED) {
      const status = statusOf(loan.closedAt, loan.loanStatus.name, loan.loanStatus.displayName);
      return {
        outcome: 'already_closed',
        message: 'This loan is already paid in full.',
        loanClosed: true,
        closedAt: loan.closedAt?.toISOString() ?? null,
        loanStatusCode: status.code,
        loanStatusLabel: status.label,
        unsettledPaymentLink: false,
        settled: [],
        attempts: [],
      };
    }

    const candidates = await this.collectCandidateTxnids(
      {
        loanId: loan.id,
        loanUuid: loan.uuid,
        loanNumber: loan.loanNumber,
        leadId: loan.application.leadId,
      },
      scope,
    );

    if (candidates.length === 0) {
      const status = statusOf(null, loan.loanStatus.name, loan.loanStatus.displayName);
      return {
        outcome: 'no_payment_link',
        message: 'No payment link is waiting to be refreshed for this loan.',
        loanClosed: false,
        closedAt: null,
        loanStatusCode: status.code,
        loanStatusLabel: status.label,
        unsettledPaymentLink: false,
        settled: [],
        attempts: [],
      };
    }

    const attempts: LosRefreshPaymentAttempt[] = [];
    const settled: LosRefreshPaymentResult['settled'] = [];
    let retrieveFailed = false;
    let loanClosed = false;

    const retrieveLimit = scope === 'pending' ? 1 : MAX_STATUS_TXNIDS;
    for (const candidate of candidates.slice(0, retrieveLimit)) {
      if (await this.settleRepayment.findSuccessByVendorRef(candidate.txnid)) {
        attempts.push({
          txnid: candidate.txnid,
          status: 'success',
          amount: candidate.amount,
          ok: true,
          alreadySettled: true,
          message: 'Already recorded',
        });
        await this.dropPendingTxnid(loan.uuid, candidate.txnid);
        continue;
      }

      const txn = await this.easebuzzWire.retrievePayTransaction(candidate.txnid, {
        forceLive: true,
      });
      attempts.push({
        txnid: candidate.txnid,
        status: txn.status,
        amount: txn.amount ?? candidate.amount,
        ok: txn.ok,
        alreadySettled: false,
        message: txn.message,
      });

      if (!txn.ok) {
        if (this.shouldDropUnpaid(txn.status, txn.message)) {
          await this.dropPendingTxnid(loan.uuid, candidate.txnid);
        } else if (!txn.status) {
          retrieveFailed = true;
        }
        continue;
      }

      const intent = await loadPendingRepayIntent(this.redis, candidate.txnid);
      const amountInr = (txn.amount || intent?.amountInr || candidate.amount || '').trim();
      if (!amountInr || !(Number.parseFloat(amountInr) > 0)) {
        attempts[attempts.length - 1].message = 'Missing payment amount';
        continue;
      }
      if (intent && !amountsMatchInr(amountInr, intent.amountInr)) {
        this.logger.warn(
          `[los-refresh-payment] Amount mismatch loan=${loan.loanNumber} txnid=${candidate.txnid} ` +
            `txn=${amountInr} intent=${intent.amountInr}`,
        );
        attempts[attempts.length - 1].message = 'Amount mismatch vs initiated payment';
        continue;
      }

      const bankRef = (txn.bankRef || txn.easepayid || candidate.txnid).trim().slice(0, 50);
      try {
        const result = await this.settleRepayment.settleSuccessfulPayment({
          loan,
          txnid: candidate.txnid,
          amountInr,
          bankRef,
        });
        settled.push({
          txnid: candidate.txnid,
          amount: amountInr,
          status: txn.status,
          closedLoan: result.closedLoan,
        });
        if (result.closedLoan) {
          loanClosed = true;
          break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'settle_failed';
        this.logger.error(
          `[los-refresh-payment] Settle failed loan=${loan.loanNumber} txnid=${candidate.txnid}: ${message}`,
        );
        attempts[attempts.length - 1].message = message;
        retrieveFailed = true;
      }
    }

    const refreshed = await this.prisma.client.loanAccount.findUnique({
      where: { id: loan.id },
      select: {
        closedAt: true,
        loanStatus: { select: { name: true, displayName: true } },
      },
    });
    const refreshedStatus = statusOf(
      refreshed?.closedAt ?? null,
      refreshed?.loanStatus.name ?? loan.loanStatus.name,
      refreshed?.loanStatus.displayName ?? loan.loanStatus.displayName,
    );
    loanClosed = loanClosed || refreshed?.closedAt != null;

    const remaining = loanClosed
      ? []
      : await this.collectCandidateTxnids(
          {
            loanId: loan.id,
            loanUuid: loan.uuid,
            loanNumber: loan.loanNumber,
            leadId: loan.application.leadId,
          },
          scope,
        );

    if (settled.length > 0) {
      return {
        outcome: 'updated',
        message: loanClosed
          ? `Payment confirmed. Loan ${loan.loanNumber} is now paid in full.`
          : `Payment confirmed for ${settled.map((row) => `₹${row.amount}`).join(', ')}. Loan is still open.`,
        loanClosed,
        closedAt: refreshed?.closedAt?.toISOString() ?? null,
        loanStatusCode: refreshedStatus.code,
        loanStatusLabel: refreshedStatus.label,
        unsettledPaymentLink: remaining.length > 0,
        settled,
        attempts,
      };
    }

    const anyPending = attempts.some((row) => PENDING_STATUSES.has((row.status ?? '').toLowerCase()));
    if (anyPending) {
      return {
        outcome: 'pending',
        message: 'Payment link was initiated. Easebuzz still reports the payment as pending.',
        loanClosed: false,
        closedAt: null,
        loanStatusCode: refreshedStatus.code,
        loanStatusLabel: refreshedStatus.label,
        unsettledPaymentLink: true,
        settled,
        attempts,
      };
    }

    if (retrieveFailed && attempts.every((row) => !row.ok && !row.alreadySettled)) {
      return {
        outcome: 'retrieve_failed',
        message: 'Could not retrieve payment status from Easebuzz. Try again shortly.',
        loanClosed: false,
        closedAt: null,
        loanStatusCode: refreshedStatus.code,
        loanStatusLabel: refreshedStatus.label,
        unsettledPaymentLink: true,
        settled,
        attempts,
      };
    }

    return {
      outcome: 'not_paid',
      message: 'Payment link was initiated, but Easebuzz does not report a successful payment.',
      loanClosed: false,
      closedAt: null,
      loanStatusCode: refreshedStatus.code,
      loanStatusLabel: refreshedStatus.label,
      unsettledPaymentLink: remaining.length > 0,
      settled,
      attempts,
    };
  }

  private shouldDropUnpaid(status: string | null, message: string | null): boolean {
    const s = (status ?? '').toLowerCase();
    if (PENDING_STATUSES.has(s)) return false;
    const msg = (message ?? '').toLowerCase();
    if (
      msg.includes('retrieve failed') ||
      msg.includes('empty transaction') ||
      msg.includes('txnid mismatch')
    ) {
      return false;
    }
    if (TERMINAL_UNPAID_STATUSES.has(s)) return true;
    if (msg.includes('not found') || msg.includes('no transaction') || msg.includes('invalid txn')) {
      return true;
    }
    // Unpaid initiate (Easebuzz 200, not success) — stop polling; webhook/surl still settle.
    return Boolean(s) || Boolean(msg);
  }

  private async dropPendingTxnid(loanUuid: string, txnid: string): Promise<void> {
    await clearPendingRepayIntent(this.redis, txnid);
    await forgetLoanRepayTxnid(this.redis, loanUuid, txnid);
  }

  private async collectCandidateTxnids(
    input: {
      loanId: bigint;
      loanUuid: string;
      loanNumber: string;
      leadId: bigint;
    },
    scope: RefreshPaymentScope = 'all',
  ): Promise<CandidateTxnid[]> {
    const compact = input.loanNumber.replace(/[^a-zA-Z0-9_|\/-]/g, '');
    const seen = new Map<string, string | null>();

    const add = (txnid: string | null | undefined, amount: string | null, udf1?: string | null) => {
      const id = txnid?.trim().slice(0, 40);
      if (!id) return;
      if (udf1 && udf1 !== input.loanUuid && udf1.toUpperCase() !== input.loanNumber.toUpperCase()) return;
      if (compact && !id.startsWith(compact)) return;
      if (!seen.has(id) || (!seen.get(id) && amount)) seen.set(id, amount);
    };

    if (scope === 'pending') {
      for (const txnid of await listLoanRepayTxnids(this.redis, input.loanUuid)) {
        add(txnid, null);
      }
    } else {
      const logs = await this.prisma.read.vendorApiLog.findMany({
        where: { leadId: input.leadId, serviceName: { in: ['pay-initiate-link', 'easycollect-create'] } },
        orderBy: { requestedAt: 'asc' },
        take: 40,
        select: { requestPayload: true },
      });
      for (const log of logs) {
        const parsed = txnidFromPayInitiatePayload(log.requestPayload);
        if (parsed) add(parsed.txnid, parsed.amount, parsed.udf1);
      }

      for (const txnid of await listLoanRepayTxnids(this.redis, input.loanUuid)) {
        add(txnid, null);
      }
    }

    // EasyCollect from the Easebuzz dashboard uses merchant_txn = loan / application number.
    add(input.loanNumber, null);

    const repaymentRefs = await this.prisma.read.$queryRaw<
      Array<{ vendor_ref: string | null; amount: unknown; status: string }>
    >`
      SELECT vendor_ref, amount, status
      FROM loan_repayment
      WHERE loan_account_id = ${input.loanId}
        AND vendor_ref IS NOT NULL
      ORDER BY created_at ASC
    `;
    const successRefs = new Set<string>();
    for (const row of repaymentRefs) {
      const ref = row.vendor_ref?.trim();
      if (!ref) continue;
      if (row.status === LOAN_REPAYMENT_STATUS.SUCCESS) {
        successRefs.add(ref);
        seen.delete(ref);
      }
    }

    return [...seen.entries()]
      .filter(([txnid]) => !successRefs.has(txnid))
      .map(([txnid, amount]) => ({ txnid, amount }))
      .reverse();
  }
}
