import { Module } from '@nestjs/common';
import { LoanDocumentApplicationService } from '../../modules/auth/application/services/loan-document-application.service';
import { SettleEasebuzzRepaymentService } from '../easebuzz/settle-easebuzz-repayment.service';
import { EmailModule } from '../email/email.module';
import { BounceChargeTierResolverService } from '../loan/bounce-charge-tier.resolver';
import { NocLetterService } from '../noc/noc-letter.service';
import { StorageModule } from '../storage/storage.module';
import { LoanDocumentDigitalSignerService } from './loan-document-digital-signer.service';
import { LoanDocumentGeneratorService } from './loan-document-generator.service';
import { LoanDocumentHtmlPdfGeneratorService } from './loan-document-html-pdf-generator.service';

@Module({
  imports: [StorageModule, EmailModule],
  providers: [
    BounceChargeTierResolverService,
    SettleEasebuzzRepaymentService,
    LoanDocumentHtmlPdfGeneratorService,
    LoanDocumentDigitalSignerService,
    LoanDocumentGeneratorService,
    LoanDocumentApplicationService,
    NocLetterService,
  ],
  exports: [
    BounceChargeTierResolverService,
    SettleEasebuzzRepaymentService,
    LoanDocumentGeneratorService,
    LoanDocumentApplicationService,
    LoanDocumentHtmlPdfGeneratorService,
    NocLetterService,
  ],
})
export class LoanDocumentsModule {}
