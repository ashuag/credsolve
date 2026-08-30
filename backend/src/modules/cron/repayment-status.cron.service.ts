import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { listPendingRepayLoanUuids } from '../../common/easebuzz/repay-intent.util';
import { RedisService } from '../../common/redis/redis.service';
import { LosLoanRepaymentSyncService } from '../los/services/los-loan-repayment-sync.service';

const LOCK_KEY = 'cron:repay-status';
const LOCK_TTL_SEC = 100;
const MAX_LOANS_PER_TICK = 20;

function isRepayStatusCronEnabled(): boolean {
  const raw = process.env.REPAY_STATUS_CRON_ENABLED?.trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'no';
}

@Injectable()
export class RepaymentStatusCronService implements OnModuleInit {
  private readonly logger = new Logger(RepaymentStatusCronService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly repaymentSync: LosLoanRepaymentSyncService,
  ) {}

  onModuleInit(): void {
    if (!isRepayStatusCronEnabled()) {
      this.logger.warn('Repayment status cron is disabled (REPAY_STATUS_CRON_ENABLED=false).');
      return;
    }
    this.logger.log('Repayment status cron registered (every 2 minutes).');
  }

  /** Walk pending Pay Now txnids; settle when Easebuzz reports success; leave pending in Redis. */
  @Cron('*/2 * * * *')
  async handlePendingRepayments(): Promise<void> {
    if (!isRepayStatusCronEnabled()) return;

    const lockToken = randomUUID();
    const acquired = await this.redis.client.set(LOCK_KEY, lockToken, 'EX', LOCK_TTL_SEC, 'NX');
    if (acquired !== 'OK') {
      this.logger.log('[repay-status-cron] Previous tick still running; skip.');
      return;
    }

    try {
      const loanUuids = (await listPendingRepayLoanUuids(this.redis)).slice(0, MAX_LOANS_PER_TICK);
      if (loanUuids.length === 0) {
        this.logger.log('[repay-status-cron] No pending repayment txnids.');
        return;
      }

      this.logger.log(`[repay-status-cron] Checking ${loanUuids.length} loan(s).`);
      for (const loanUuid of loanUuids) {
        try {
          const result = await this.repaymentSync.refreshPayment(loanUuid);
          this.logger.log(
            `[repay-status-cron] loan=${loanUuid} outcome=${result.outcome} ` +
              `settled=${result.settled.length} closed=${result.loanClosed}`,
          );
        } catch (error) {
          this.logger.warn(
            `[repay-status-cron] loan=${loanUuid} failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } finally {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        end
        return 0
      `;
      await this.redis.client.eval(script, 1, LOCK_KEY, lockToken);
    }
  }
}
