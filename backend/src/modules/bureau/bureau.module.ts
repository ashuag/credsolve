import { Module } from '@nestjs/common';
import { CibilModule } from '../../common/cibil/cibil.module';
import { CustomerOrLosAuthGuard } from '../../common/guards/customer-or-los-auth.guard';
import { RedisIpRateLimitGuard } from '../../common/rate-limit/redis-ip-rate-limit.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LosModule } from '../los/los.module';
import { FetchBureauUseCase } from './application/fetch-bureau.use-case';
import { TenacioBureauController } from './presentation/tenacio-bureau.controller';

@Module({
  imports: [PrismaModule, CibilModule, LosModule, AuthModule],
  controllers: [TenacioBureauController],
  providers: [RedisIpRateLimitGuard, CustomerOrLosAuthGuard, FetchBureauUseCase],
})
export class BureauModule {}
