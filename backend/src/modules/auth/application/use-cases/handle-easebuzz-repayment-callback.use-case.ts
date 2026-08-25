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
import { LOAN_REPAYMENT_STATUS } from '../../../../common/constants/loan-repayment.constants';
import { LOAN_STATUS } from '../../../../common/constants/loan.constants';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import {
  computeAmountDueNowInr,
  computeTenureDays,
  decimalToNumber,
} from '../../../../common/loan/loan-calculation.util';
import {
  remainingDueInr,
  shouldCloseLoanAfterPayment,
  sumSuccessfulRepaymentsInr,
} from '../../../../common/loan/loan-repayment-outstanding.util';
import {
  isRepaymentPastDue,
  overdueDaysFromMaturity,
} from '../../../../common/loan/bounce-charge.util';
import { BounceChargeTierResolverService } from '../../../../common/loan/bounce-charge-tier.resolver';
import { canDeactivateConvertedLeadForReapply } from '../../../../common/loan/customer-open-loan.util';
import { RedisService } from '../../../../common/redis/redis.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';

const SETTLE_LOCK_TTL_SEC = 120;

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
    private readonly leads: LeadRepository,
    private readonly easebuzzWire: EasebuzzWireService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly settings: SettingsRepository,
    private readonly bounceChargeTiers: BounceChargeTierResolverService,
  ) {}

  /**
   * Handles Easebuzz browser POST/GET to surl/furl.
   *
   * Security gates before marking loan CLOSED:
   * 1. Timing-safe reverse-hash verification (salt)
   * 2. Merchant key match
   * 3. Pending repay intent (txnid we created) + UDF/loan consistency
   * 4. Amount match vs intent (and optional txn retrieve amount)
   * 5. Server-side Transaction V2 retrieve must report success
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
    const priorSuccess = await this.findSuccessByVendorRef(txnid);
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

    const principal = decimalToNumber(loan.principalAmount);
    const dailyRate = decimalToNumber(loan.interestRate);
    const coolingPeriodDays = await this.settings.loadRepayCoolingPeriodDays();
    const due =
      principal != null && dailyRate != null
        ? computeAmountDueNowInr(principal, dailyRate, loan.disbursedAt, {
            coolingPeriodDays,
            tenureDays: computeTenureDays(loan.disbursedAt, loan.loanMaturityDate),
          })
        : null;
    const amountInr = intent.amountInr;
    const paidThis = Number.parseFloat(amountInr);

    const pastDue =
      loan.loanStatus.name === LOAN_STATUS.OVERDUE || isRepaymentPastDue(loan.loanMaturityDate);
    const overdueDays = pastDue
      ? Math.max(overdueDaysFromMaturity(loan.loanMaturityDate), 1)
      : 0;
    const bounceFeeInr =
      principal != null
        ? await this.bounceChargeTiers.resolveChargeForAmount(principal, overdueDays)
        : 0;
    const billDueNow =
      due != null ? Math.round((due.amountDue + bounceFeeInr) * 100) / 100 : paidThis;

    const closedStatus = await this.prisma.client.loanStatus.findFirst({
      where: { name: LOAN_STATUS.CLOSED, isActive: true },
      select: { id: true },
    });

    // --- 6. Settle under lock ---
    const lockKey = `customer:repay-settle:${txnid}`;
    const lockToken = randomUUID();
    const acquired = await this.redis.client.set(
      lockKey,
      lockToken,
      'EX',
      SETTLE_LOCK_TTL_SEC,
      'NX',
    );
    if (acquired !== 'OK') {
      // Another callback is settling; wait briefly then check idempotency.
      await new Promise((r) => setTimeout(r, 800));
      if (await this.findSuccessByVendorRef(txnid)) {
        await clearPendingRepayIntent(this.redis, txnid);
        return redirect('success');
      }
      return redirect('error', 'settle_in_progress');
    }

    const repaymentUuid = randomUUID();
    try {
      // Re-check after lock.
      if (await this.findSuccessByVendorRef(txnid)) {
        await clearPendingRepayIntent(this.redis, txnid);
        return redirect('success');
      }

      await this.prisma.client.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: bigint; closed_at: Date | null }>>`
          SELECT id, closed_at
          FROM loan_account
          WHERE id = ${loan.id}
          FOR UPDATE
        `;
        if (!locked[0]) {
          throw new Error('loan_missing');
        }
        if (locked[0].closed_at != null) {
          return;
        }

        // Guard duplicate SUCCESS rows for same vendor_ref.
        const existing = await tx.$queryRaw<Array<{ id: bigint }>>`
          SELECT id FROM loan_repayment
          WHERE vendor_ref = ${txnid.slice(0, 50)}
            AND status = ${LOAN_REPAYMENT_STATUS.SUCCESS}
          LIMIT 1
        `;
        if (existing[0]) {
          return;
        }

        const paidBefore = await sumSuccessfulRepaymentsInr(tx, loan.id);
        const remainingAfter = remainingDueInr(
          billDueNow,
          paidBefore + (Number.isFinite(paidThis) ? paidThis : 0),
        );
        const closesLoan = shouldCloseLoanAfterPayment(remainingAfter);

        await tx.$executeRaw`
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
            ${repaymentUuid},
            ${loan.id},
            ${amountInr},
            ${'UPI'},
            ${LOAN_REPAYMENT_STATUS.SUCCESS},
            ${bankRef},
            ${null},
            ${txnid.slice(0, 50)},
            ${paidAt},
            ${paidAt}
          )
        `;

        if (closesLoan) {
          if (!closedStatus) {
            this.logger.error('[repay-callback] CLOSED loan status missing');
            throw new Error('status_missing');
          }
          const collected = Math.round((paidBefore + (Number.isFinite(paidThis) ? paidThis : 0)) * 100) / 100;
          await tx.loanAccount.update({
            where: { id: loan.id },
            data: {
              loanStatusId: closedStatus.id,
              closedAt: paidAt,
              interestAmount: due ? due.interestAmount.toFixed(2) : undefined,
              totalRepaymentAmount: collected.toFixed(2),
            },
          });

          const lead = await tx.lead.findUnique({
            where: { id: loan.application.leadId },
            select: { id: true, leadStatus: { select: { name: true } } },
          });
          if (lead?.leadStatus.name === LEAD_STATUS.CONVERTED) {
            const mayReapply = await canDeactivateConvertedLeadForReapply(tx, lead.id);
            if (mayReapply) {
              await this.leads.deactivate(lead.id, tx);
            }
          }
        }
      });
    } catch (error) {
      this.logger.error(
        `[repay-callback] Settle failed loan=${loan.loanNumber} txnid=${txnid}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return redirect('error', 'settle_failed');
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }

    await clearPendingRepayIntent(this.redis, txnid);
    this.logger.log(
      `[repay-callback] SUCCESS loan=${loan.loanNumber} txnid=${txnid} repayment=${repaymentUuid}`,
    );
    return redirect('success');
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

  private async findSuccessByVendorRef(txnid: string): Promise<boolean> {
    const rows = await this.prisma.client.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM loan_repayment
      WHERE vendor_ref = ${txnid.slice(0, 50)}
        AND status = ${LOAN_REPAYMENT_STATUS.SUCCESS}
      LIMIT 1
    `;
    return Boolean(rows[0]);
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

  private async releaseLock(lockKey: string, lockToken: string): Promise<void> {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        end
        return 0
      `;
      await this.redis.client.eval(script, 1, lockKey, lockToken);
    } catch (error) {
      this.logger.warn(
        `[repay-callback] Failed to release lock ${lockKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
