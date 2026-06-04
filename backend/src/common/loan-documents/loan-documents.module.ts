import { Module } from '@nestjs/common';
import { LoanDocumentDigitalSignerService } from './loan-document-digital-signer.service';
import { LoanDocumentGeneratorService } from './loan-document-generator.service';
import { LoanDocumentHtmlPdfGeneratorService } from './loan-document-html-pdf-generator.service';

@Module({
  providers: [
    LoanDocumentHtmlPdfGeneratorService,
    LoanDocumentDigitalSignerService,
    LoanDocumentGeneratorService,
  ],
  exports: [LoanDocumentGeneratorService],
})
export class LoanDocumentsModule {}
