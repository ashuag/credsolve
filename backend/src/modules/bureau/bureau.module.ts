import { Module } from '@nestjs/common';
import { CustomerOrLosAuthGuard } from '../../common/guards/customer-or-los-auth.guard';
import { RedisIpRateLimitGuard } from '../../common/rate-limit/redis-ip-rate-limit.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LosModule } from '../los/los.module';
import { FetchCibilUseCase } from './application/fetch-cibil.use-case';
import { TenacioCibilController } from './presentation/tenacio-cibil.controller';

@Module({
  imports: [PrismaModule, LosModule, AuthModule],
  controllers: [TenacioCibilController],
  providers: [RedisIpRateLimitGuard, CustomerOrLosAuthGuard, FetchCibilUseCase],
})
export class BureauModule {}
