import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LosDisbursementService } from '../los/services/los-disbursement.service';

function isDisbursalStatusCronEnabled(): boolean {
  const raw = process.env.DISBURSAL_STATUS_CRON_ENABLED?.trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'no';
}

@Injectable()
export class DisbursalStatusCronService implements OnModuleInit {
  private readonly logger = new Logger(DisbursalStatusCronService.name);

  constructor(private readonly disbursement: LosDisbursementService) {}

  onModuleInit(): void {
    if (!isDisbursalStatusCronEnabled()) {
      this.logger.warn('In-app disbursal status cron is disabled (DISBURSAL_STATUS_CRON_ENABLED=false).');
      return;
    }
    this.logger.log('In-app disbursal status cron registered (every 5 minutes).');
  }

  /** Ask Easebuzz for the latest status of payouts still in process. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleInProcessDisbursals(): Promise<void> {
    if (!isDisbursalStatusCronEnabled()) return;
    await this.disbursement.pollInProcessDisbursals();
  }
}
