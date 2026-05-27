import { Module } from '@nestjs/common';
import { LoanDocumentGeneratorService } from './loan-document-generator.service';
import { LoanDocumentPdfGeneratorService } from './loan-document-pdf-generator.service';

@Module({
  providers: [LoanDocumentPdfGeneratorService, LoanDocumentGeneratorService],
  exports: [LoanDocumentGeneratorService],
})
export class LoanDocumentsModule {}
