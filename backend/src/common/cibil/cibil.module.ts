import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CreditLimitTierResolverService } from './credit-limit-tier-resolver.service';

@Module({
  imports: [PrismaModule],
  providers: [CreditLimitTierResolverService],
  exports: [CreditLimitTierResolverService],
})
export class CibilModule {}
