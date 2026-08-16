import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BureauReportPdfService } from './bureau-report-pdf.service';
import { CibilCreditAssessmentService } from './cibil-credit-assessment.service';
import { CibilReportPdfGeneratorService } from './cibil-report-pdf-generator.service';
import { CreditLimitTierResolverService } from './credit-limit-tier-resolver.service';

@Module({
  imports: [PrismaModule],
  providers: [
    CreditLimitTierResolverService,
    CibilReportPdfGeneratorService,
    BureauReportPdfService,
    CibilCreditAssessmentService,
  ],
  exports: [CreditLimitTierResolverService, BureauReportPdfService, CibilCreditAssessmentService],
})
export class CibilModule {}
