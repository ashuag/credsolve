import { Module } from '@nestjs/common';
import { KycFilesService } from '../kyc/kyc-files.service';
import { LoanDocumentGeneratorService } from './loan-document-generator.service';
import { LoanDocumentPdfGeneratorService } from './loan-document-pdf-generator.service';

@Module({
  providers: [KycFilesService, LoanDocumentPdfGeneratorService, LoanDocumentGeneratorService],
  exports: [KycFilesService, LoanDocumentGeneratorService],
})
export class LoanDocumentsModule {}
