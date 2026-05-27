import { Module } from '@nestjs/common';
import { KycFilesService } from '../kyc/kyc-files.service';
import { LoanDocumentGeneratorService } from './loan-document-generator.service';

@Module({
  providers: [KycFilesService, LoanDocumentGeneratorService],
  exports: [KycFilesService, LoanDocumentGeneratorService],
})
export class LoanDocumentsModule {}
