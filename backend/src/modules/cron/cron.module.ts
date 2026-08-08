import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { SettingsRepository } from '../auth/infrastructure/repositories/settings.repository';
import { LeadExpiryCronService } from './lead-expiry.cron.service';
import { LoanOverdueCronService } from './loan-overdue.cron.service';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [SettingsRepository, LeadExpiryCronService, LoanOverdueCronService],
})
export class CronModule {}
