import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { SettingsRepository } from '../auth/infrastructure/repositories/settings.repository';
import { LosModule } from '../los/los.module';
import { LeadExpiryCronService } from './lead-expiry.cron.service';
import { LoanOverdueCronService } from './loan-overdue.cron.service';
import { RepaymentStatusCronService } from './repayment-status.cron.service';

@Module({
  imports: [PrismaModule, RedisModule, LosModule],
  providers: [
    SettingsRepository,
    LeadExpiryCronService,
    LoanOverdueCronService,
    RepaymentStatusCronService,
  ],
})
export class CronModule {}
