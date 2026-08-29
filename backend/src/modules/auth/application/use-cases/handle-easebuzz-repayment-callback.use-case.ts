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

@Injectable()
export class HandleEasebuzzRepaymentCallbackUseCase {
  private readonly logger = new Logger(HandleEasebuzzRepaymentCallbackUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly easebuzzWire: EasebuzzWireService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly settleRepayment: SettleEasebuzzRepaymentService,
  ) {}

  /**
   * Handles Easebuzz browser POST/GET to surl/furl.
   *
   * Security gates before marking loan CLOSED:
   * 1. Timing-safe reverse-hash verification (salt)
   * 2. Merchant key match
   * 3. Pending repay intent (txnid we created) + UDF/loan consistency
   * 4. Amount match vs intent (and optional txn retrieve amount)
   * 5. Server-side Transaction V2.1 retrieve must report success
   * 6. Redis settle lock + FOR UPDATE so close is idempotent
   */
  async execute(
    payload: Record<string, unknown>,
    kind: 'success' | 'failure',
  ): Promise<string> {
    const fields = asStringMap(payload);
    const txnid = fields.txnid?.trim() ?? '';
    const status = (fields.status ?? '').trim().toLowerCase();
    const portalBase =
      envTrim(this.config, 'CUSTOMER_PORTAL_BASE_URL').replace(/\/+$/, '') ||
      'http://localhost:3021';

    const redirect = (result: 'success' | 'failed' | 'error', code?: string) => {
      const q = new URLSearchParams({ repay: result });
      if (txnid) q.set('txnid', txnid.slice(0, 40));
      if (code) q.set('code', code.slice(0, 40));
      return `${portalBase}/my-account?${q.toString()}`;
    };

    if (!txnid) {
      this.logger.warn(`[repay-callback] Missing txnid kind=${kind}`);
      return redirect('error', 'missing_txnid');
    }

    // --- 1–2. Authenticate callback (hash + merchant key) ---
    let merchantKey: string;
    try {
      const creds = this.easebuzzWire.getPayCredentialsOrThrow();
      merchantKey = creds.key;
      const expected = buildPayCallbackReverseHash(fields, creds.salt);
      if (!payCallbackHashMatches(fields.hash ?? '', expected)) {
        this.logger.warn(`[repay-callback] Hash mismatch txnid=${txnid} kind=${kind}`);
        return redirect('error', 'hash_mismatch');
      }
      const postedKey = (fields.key ?? '').trim();
      if (!timingSafeEqualUtf8(postedKey, merchantKey)) {
        this.logger.warn(`[repay-callback] Merchant key mismatch txnid=${txnid}`);
        return redirect('error', 'key_mismatch');
      }
    } catch (error) {
      this.logger.error(
        `[repay-callback] Config/hash error txnid=${txnid}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return redirect('error', 'config');
    }

    // Idempotent: this txnid already settled successfully.
    const priorSuccess = await this.settleRepayment.findSuccessByVendorRef(txnid);
    if (priorSuccess) {
      this.logger.log(`[repay-callback] Already settled txnid=${txnid}`);
      await clearPendingRepayIntent(this.redis, txnid);
      return redirect('success');
    }

    const intent = await loadPendingRepayIntent(this.redis, txnid);
    const loanAccountUuid = (fields.udf1 ?? intent?.loanAccountUuid ?? '').trim();
    if (!loanAccountUuid) {
      this.logger.warn(`[repay-callback] Missing loan uuid txnid=${txnid}`);
      return redirect('error', 'missing_loan');
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
      return redirect('error', 'loan_not_found');
    }

    // --- 3. Bind callback to our loan / intent (anti-tamper on UDFs) ---
    const consistencyError = this.checkLoanBinding(fields, loan, intent);
    if (consistencyError) {
      this.logger.warn(
        `[repay-callback] Binding failed txnid=${txnid} loan=${loan.loanNumber}: ${consistencyError}`,
      );
      return redirect('error', consistencyError);
    }

    // Loan already closed by another payment — do not reopen; treat as success for UX.
    if (loan.closedAt != null || loan.loanStatus.name === LOAN_STATUS.CLOSED) {
      this.logger.log(`[repay-callback] Loan already closed loan=${loan.loanNumber} txnid=${txnid}`);
      await clearPendingRepayIntent(this.redis, txnid);
      return redirect('success');
    }

    const paidAt = new Date();
    const callbackLooksSuccessful =
      kind === 'success' && isCallbackSuccessStatus(status);

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
      return redirect('failed', 'payment_failed');
    }

    // Pending intent is required for success settlement (proves we initiated this txnid).
    if (!intent) {
      this.logger.warn(`[repay-callback] Missing pending intent txnid=${txnid}`);
      return redirect('error', 'unknown_txn');
    }

    // --- 4. Amount must match what we initiated ---
    const callbackAmount = (fields.amount ?? '').trim();
    if (!callbackAmount || !amountsMatchInr(callbackAmount, intent.amountInr)) {
      this.logger.warn(
        `[repay-callback] Amount mismatch txnid=${txnid} callback=${callbackAmount} intent=${intent.amountInr}`,
      );
      return redirect('error', 'amount_mismatch');
    }

    // --- 5. Server-side Transaction API confirmation (do not trust browser alone) ---
    const txn = await this.easebuzzWire.retrievePayTransaction(txnid);
    if (!txn.ok || !txn.status || !isCallbackSuccessStatus(txn.status)) {
      this.logger.warn(
        `[repay-callback] Txn retrieve not success txnid=${txnid} status=${txn.status ?? 'n/a'} msg=${txn.message ?? ''}`,
      );
      return redirect('error', 'txn_unconfirmed');
    }
    if (txn.amount && !amountsMatchInr(txn.amount, intent.amountInr)) {
      this.logger.warn(
        `[repay-callback] Txn retrieve amount mismatch txnid=${txnid} txn=${txn.amount} intent=${intent.amountInr}`,
      );
      return redirect('error', 'amount_mismatch');
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
      return redirect('success');
    } catch (error) {
      const code = error instanceof Error ? error.message : 'settle_failed';
      this.logger.error(
        `[repay-callback] Settle failed loan=${loan.loanNumber} txnid=${txnid}: ${code}`,
      );
      return redirect('error', code === 'settle_in_progress' ? 'settle_in_progress' : 'settle_failed');
    }
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

    // txnid must start with loan_number (how we generate it).
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
      // Avoid duplicate FAILED spam for the same txnid.
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
