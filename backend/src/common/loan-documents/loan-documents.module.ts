import { Module } from '@nestjs/common';
import { LoanDocumentApplicationService } from '../../modules/auth/application/services/loan-document-application.service';
import { StorageModule } from '../storage/storage.module';
import { LoanDocumentDigitalSignerService } from './loan-document-digital-signer.service';
import { LoanDocumentGeneratorService } from './loan-document-generator.service';
import { LoanDocumentHtmlPdfGeneratorService } from './loan-document-html-pdf-generator.service';

@Module({
  imports: [StorageModule],
  providers: [
    LoanDocumentHtmlPdfGeneratorService,
    LoanDocumentDigitalSignerService,
    LoanDocumentGeneratorService,
    LoanDocumentApplicationService,
  ],
  exports: [LoanDocumentGeneratorService, LoanDocumentApplicationService],
})
export class LoanDocumentsModule {}
