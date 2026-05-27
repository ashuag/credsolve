import { Module } from '@nestjs/common';
import { CibilModule } from '../cibil/cibil.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PostBreCheckService } from './post-bre-check.service';
import { PreApprovedOfferDryRunService } from './pre-approved-offer-dry-run.service';
import { PreBreCheckService } from './pre-bre-check.service';

@Module({
  imports: [PrismaModule, CibilModule],
  providers: [PreBreCheckService, PostBreCheckService, PreApprovedOfferDryRunService],
  exports: [PreBreCheckService, PostBreCheckService, PreApprovedOfferDryRunService],
})
export class BreModule {}
