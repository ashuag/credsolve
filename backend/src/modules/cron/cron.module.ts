import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { LosModule } from '../los/los.module';
import { SettingsRepository } from '../auth/infrastructure/repositories/settings.repository';
import { DisbursalStatusCronService } from './disbursal-status.cron.service';
import { LeadExpiryCronService } from './lead-expiry.cron.service';
import { LoanOverdueCronService } from './loan-overdue.cron.service';

@Module({
  imports: [PrismaModule, RedisModule, LosModule],
  providers: [SettingsRepository, LeadExpiryCronService, LoanOverdueCronService, DisbursalStatusCronService],
})
export class CronModule {}
