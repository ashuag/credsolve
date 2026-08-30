import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  buildPayCallbackReverseHash,
  EasebuzzWireService,
  payCallbackHashMatches,
  timingSafeEqualUtf8,
} from '../../../../common/easebuzz/easebuzz-wire.service';
import {
  amountsMatchInr,
  clearPendingRepayIntent,
  loadPendingRepayIntent,
  type PendingRepayIntent,
} from '../../../../common/easebuzz/repay-intent.util';
import { EasebuzzRepaymentNotificationService } from '../../../../common/easebuzz/easebuzz-repayment-notification.service';
import { SettleEasebuzzRepaymentService } from '../../../../common/easebuzz/settle-easebuzz-repayment.service';
import { LOAN_REPAYMENT_STATUS } from '../../../../common/constants/loan-repayment.constants';
import { LOAN_STATUS } from '../../../../common/constants/loan.constants';
import { RedisService } from '../../../../common/redis/redis.service';
import { PrismaService } from '../../../../prisma/prisma.service';

function envTrim(config: ConfigService, key: string): string {
  const direct = process.env[key];
  if (direct != null && String(direct).trim().length > 0) {
    return String(direct).trim();
  }
  const fromNest = config.get<string>(key);
  if (fromNest != null && String(fromNest).trim().length > 0) {
    return String(fromNest).trim();
  }
  return '';
}

function asStringMap(payload: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;
    if (typeof value === 'string') out[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = String(value);
  }
  return out;
}

function truncateError(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function isCallbackSuccessStatus(status: string): boolean {
  return status === 'success' || status === 'successful';
}

export type EasebuzzRepayNotificationOutcome = {
  txnid: string;
  result: 'success' | 'failed' | 'error' | 'pending';
  code?: string;
};

const CLIENT_ERROR_CODES = new Set([
  'missing_txnid',
  'hash_mismatch',
  'key_mismatch',
  'config',
]);

const RETRY_ERROR_CODES = new Set(['settle_failed', 'settle_in_progress']);

@Injectable()
export class HandleEasebuzzRepaymentCallbackUseCase {
  private readonly logger = new Logger(HandleEasebuzzRepaymentCallbackUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly easebuzzWire: EasebuzzWireService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly settleRepayment: SettleEasebuzzRepaymentService,
    private readonly notifications: EasebuzzRepaymentNotificationService,
  ) {}

  /**
   * Handles Easebuzz browser POST/GET to surl/furl.
   */
  async execute(
    payload: Record<string, unknown>,
    kind: 'success' | 'failure',
  ): Promise<string> {
    const rowId = await this.notifications.begin(kind === 'success' ? 'surl' : 'furl', payload);
    const outcome = await this.process(payload, kind, rowId);
    await this.notifications.finish(rowId, outcome);
    return this.redirectUrl(outcome);
  }

  /**
   * Server-to-server webhook. Same settle path as surl; returns JSON (no redirect).
   * 400 = bad auth / missing txnid. 500 = retry. 200 = processed or still pending.
   */
  async executeWebhook(payload: Record<string, unknown>): Promise<{
    httpStatus: number;
    body: Record<string, unknown>;
  }> {
    const rowId = await this.notifications.begin('webhook', payload);
    const fields = asStringMap(payload);
    const status = (fields.status ?? '').trim().toLowerCase();
    const kind: 'success' | 'failure' =
      status && !isCallbackSuccessStatus(status) ? 'failure' : 'success';
    const outcome = await this.process(payload, kind, rowId);
    await this.notifications.finish(rowId, outcome);
    const httpStatus = webhookHttpStatus(outcome);
    this.logger.log(
      `[repay-webhook] txnid=${outcome.txnid || 'n/a'} result=${outcome.result} ` +
        `code=${outcome.code ?? 'n/a'} http=${httpStatus}`,
    );
    return {
      httpStatus,
      body: {
        ok: httpStatus === 200,
        result: outcome.result,
        code: outcome.code ?? null,
        txnid: outcome.txnid || null,
        source: 'webhook',
      },
    };
  }

  /**
   * Security gates before marking loan CLOSED:
   * 1. Timing-safe reverse-hash verification (salt)
   * 2. Merchant key match
   * 3. Pending repay intent (txnid we created) + UDF/loan consistency
   * 4. Amount match vs intent (and optional txn retrieve amount)
   * 5. Server-side Transaction V2.1 retrieve must report success
   * 6. Redis settle lock + FOR UPDATE so close is idempotent
   */
  private async process(
    payload: Record<string, unknown>,
    kind: 'success' | 'failure',
    notificationId: bigint | null,
  ): Promise<EasebuzzRepayNotificationOutcome> {
    const fields = asStringMap(payload);
    const txnid = fields.txnid?.trim() ?? '';
    const status = (fields.status ?? '').trim().toLowerCase();

    if (!txnid) {
      this.logger.warn(`[repay-callback] Missing txnid kind=${kind}`);
      return { txnid: '', result: 'error', code: 'missing_txnid' };
    }

    try {
      const creds = this.easebuzzWire.getPayCredentialsOrThrow();
      const expected = buildPayCallbackReverseHash(fields, creds.salt);
      if (!payCallbackHashMatches(fields.hash ?? '', expected)) {
        this.logger.warn(`[repay-callback] Hash mismatch txnid=${txnid} kind=${kind}`);
        return { txnid, result: 'error', code: 'hash_mismatch' };
      }
      const postedKey = (fields.key ?? '').trim();
      if (!timingSafeEqualUtf8(postedKey, creds.key)) {
        this.logger.warn(`[repay-callback] Merchant key mismatch txnid=${txnid}`);
        return { txnid, result: 'error', code: 'key_mismatch' };
      }
    } catch (error) {
      this.logger.error(
        `[repay-callback] Config/hash error txnid=${txnid}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { txnid, result: 'error', code: 'config' };
    }

    const priorSuccess = await this.settleRepayment.findSuccessByVendorRef(txnid);
    if (priorSuccess) {
      this.logger.log(`[repay-callback] Already settled txnid=${txnid}`);
      await clearPendingRepayIntent(this.redis, txnid);
      return { txnid, result: 'success' };
    }

    const intent = await loadPendingRepayIntent(this.redis, txnid);
    const loanAccountUuid = (fields.udf1 ?? intent?.loanAccountUuid ?? '').trim();
    if (!loanAccountUuid) {
      this.logger.warn(`[repay-callback] Missing loan uuid txnid=${txnid}`);
      return { txnid, result: 'error', code: 'missing_loan' };
    }

    const loan = await this.prisma.client.loanAccount.findFirst({
      where: { uuid: loanAccountUuid },
      select: {
        id: true,
        uuid: true,
        loanNumber: true,
        principalAmount: true,
        interestRate: true,
        disbursedAt: true,
        loanMaturityDate: true,
        closedAt: true,
        loanStatus: { select: { name: true } },
        application: {
          select: {
            id: true,
            uuid: true,
            leadId: true,
          },
        },
      },
    });

    if (!loan) {
      this.logger.warn(`[repay-callback] Loan not found uuid=${loanAccountUuid} txnid=${txnid}`);
      return { txnid, result: 'error', code: 'loan_not_found' };
    }

    await this.notifications.attachLoan(notificationId, loan.id);

    const consistencyError = this.checkLoanBinding(fields, loan, intent);
    if (consistencyError) {
      this.logger.warn(
        `[repay-callback] Binding failed txnid=${txnid} loan=${loan.loanNumber}: ${consistencyError}`,
      );
      return { txnid, result: 'error', code: consistencyError };
    }

    if (loan.closedAt != null || loan.loanStatus.name === LOAN_STATUS.CLOSED) {
      this.logger.log(`[repay-callback] Loan already closed loan=${loan.loanNumber} txnid=${txnid}`);
      await clearPendingRepayIntent(this.redis, txnid);
      return { txnid, result: 'success' };
    }

    const paidAt = new Date();
    const callbackLooksSuccessful = kind === 'success' && isCallbackSuccessStatus(status);

    if (!callbackLooksSuccessful) {
      const failureMessage = truncateError(
        fields.error || fields.error_Message || fields.msg || fields.status || 'Payment failed',
      );
      await this.recordFailedAttempt({
        loanAccountId: loan.id,
        amountInr: (fields.amount || intent?.amountInr || '0').slice(0, 20),
        txnid,
        failureMessage,
        paidAt,
      });
      await clearPendingRepayIntent(this.redis, txnid);
      this.logger.warn(
        `[repay-callback] FAILED loan=${loan.loanNumber} txnid=${txnid} status=${status || kind}`,
      );
      return { txnid, result: 'failed', code: 'payment_failed' };
    }

    if (!intent) {
      this.logger.warn(`[repay-callback] Missing pending intent txnid=${txnid}`);
      return { txnid, result: 'error', code: 'unknown_txn' };
    }

    const callbackAmount = (fields.amount ?? '').trim();
    if (!callbackAmount || !amountsMatchInr(callbackAmount, intent.amountInr)) {
      this.logger.warn(
        `[repay-callback] Amount mismatch txnid=${txnid} callback=${callbackAmount} intent=${intent.amountInr}`,
      );
      return { txnid, result: 'error', code: 'amount_mismatch' };
    }

    const txn = await this.easebuzzWire.retrievePayTransaction(txnid);
    await this.notifications.attachConfirm(notificationId, {
      ok: txn.ok,
      status: txn.status,
      amount: txn.amount,
      easepayid: txn.easepayid,
      bankRef: txn.bankRef,
      message: txn.message,
      retrieveUrl: txn.retrieveUrl,
      rawBody: txn.rawBody,
    });
    if (!txn.ok || !txn.status || !isCallbackSuccessStatus(txn.status)) {
      this.logger.warn(
        `[repay-callback] Txn retrieve not success txnid=${txnid} status=${txn.status ?? 'n/a'} msg=${txn.message ?? ''}`,
      );
      return { txnid, result: 'pending', code: 'txn_unconfirmed' };
    }
    if (txn.amount && !amountsMatchInr(txn.amount, intent.amountInr)) {
      this.logger.warn(
        `[repay-callback] Txn retrieve amount mismatch txnid=${txnid} txn=${txn.amount} intent=${intent.amountInr}`,
      );
      return { txnid, result: 'error', code: 'amount_mismatch' };
    }

    const bankRef = (
      txn.bankRef ||
      txn.easepayid ||
      fields.bank_ref_num ||
      fields.easepayid ||
      txnid
    )
      .trim()
      .slice(0, 50);

    try {
      const settled = await this.settleRepayment.settleSuccessfulPayment({
        loan,
        txnid,
        amountInr: intent.amountInr,
        bankRef,
        paidAt,
      });
      this.logger.log(
        `[repay-callback] SUCCESS loan=${loan.loanNumber} txnid=${txnid} ` +
          `repayment=${settled.repaymentUuid ?? 'existing'} closed=${settled.closedLoan}`,
      );
      return { txnid, result: 'success' };
    } catch (error) {
      const code = error instanceof Error ? error.message : 'settle_failed';
      this.logger.error(
        `[repay-callback] Settle failed loan=${loan.loanNumber} txnid=${txnid}: ${code}`,
      );
      return {
        txnid,
        result: 'error',
        code: code === 'settle_in_progress' ? 'settle_in_progress' : 'settle_failed',
      };
    }
  }

  private redirectUrl(outcome: EasebuzzRepayNotificationOutcome): string {
    const portalBase =
      envTrim(this.config, 'CUSTOMER_PORTAL_BASE_URL').replace(/\/+$/, '') ||
      'http://localhost:3021';
    const repay =
      outcome.result === 'success' ? 'success' : outcome.result === 'failed' ? 'failed' : 'error';
    const q = new URLSearchParams({ repay });
    if (outcome.txnid) q.set('txnid', outcome.txnid.slice(0, 40));
    if (outcome.code) q.set('code', outcome.code.slice(0, 40));
    return `${portalBase}/my-account?${q.toString()}`;
  }

  private checkLoanBinding(
    fields: Record<string, string>,
    loan: {
      uuid: string;
      loanNumber: string;
      application: { uuid: string };
    },
    intent: PendingRepayIntent | null,
  ): string | null {
    const udf1 = (fields.udf1 ?? '').trim();
    const udf2 = (fields.udf2 ?? '').trim();
    const udf3 = (fields.udf3 ?? '').trim();
    const txnid = (fields.txnid ?? '').trim();

    if (udf1 && udf1 !== loan.uuid) return 'udf_loan_mismatch';
    if (udf2 && udf2 !== loan.application.uuid) return 'udf_app_mismatch';
    if (udf3 && udf3 !== loan.loanNumber) return 'udf_loan_number_mismatch';

    if (intent) {
      if (intent.loanAccountUuid !== loan.uuid) return 'intent_loan_mismatch';
      if (intent.applicationUuid !== loan.application.uuid) return 'intent_app_mismatch';
      if (intent.loanNumber !== loan.loanNumber) return 'intent_loan_number_mismatch';
    }

    const compactLoan = loan.loanNumber.replace(/[^a-zA-Z0-9_|\/-]/g, '');
    if (compactLoan && !txnid.startsWith(compactLoan)) {
      return 'txnid_loan_mismatch';
    }

    return null;
  }

  private async recordFailedAttempt(input: {
    loanAccountId: bigint;
    amountInr: string;
    txnid: string;
    failureMessage: string;
    paidAt: Date;
  }): Promise<void> {
    try {
      const existing = await this.prisma.client.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM loan_repayment
        WHERE vendor_ref = ${input.txnid.slice(0, 50)}
        LIMIT 1
      `;
      if (existing[0]) return;

      await this.prisma.client.$executeRaw`
        INSERT INTO loan_repayment (
          uuid,
          loan_account_id,
          amount,
          payment_mode,
          status,
          utr,
          failure_message,
          vendor_ref,
          paid_at,
          created_at
        ) VALUES (
          ${randomUUID()},
          ${input.loanAccountId},
          ${input.amountInr},
          ${'UPI'},
          ${LOAN_REPAYMENT_STATUS.FAILED},
          ${null},
          ${input.failureMessage},
          ${input.txnid.slice(0, 50)},
          ${input.paidAt},
          ${input.paidAt}
        )
      `;
    } catch (error) {
      this.logger.warn(
        `[repay-callback] Could not persist FAILED attempt: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function webhookHttpStatus(outcome: EasebuzzRepayNotificationOutcome): number {
  if (outcome.result !== 'error') return 200;
  if (CLIENT_ERROR_CODES.has(outcome.code ?? '')) return 400;
  if (RETRY_ERROR_CODES.has(outcome.code ?? '')) return 500;
  return 200;
}
