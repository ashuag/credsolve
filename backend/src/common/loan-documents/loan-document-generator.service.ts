import { BadRequestException, Injectable } from '@nestjs/common';
import { LOAN_DOCUMENT_PDF_FILES, LOAN_DOCUMENT_TYPE, type LoanDocumentType } from '../constants/loan-document.constants';
import { LoanDocumentDigitalSignerService } from './loan-document-digital-signer.service';
import { LoanDocumentHtmlPdfGeneratorService } from './loan-document-html-pdf-generator.service';
import type { LoanDocumentMergeInput } from './loan-document.types';

/** Generates sanction letter cum KFS PDF from HTML template, then PKCS#7-signs. */
@Injectable()
export class LoanDocumentGeneratorService {
  constructor(
    private readonly htmlPdfGenerator: LoanDocumentHtmlPdfGeneratorService,
    private readonly signer: LoanDocumentDigitalSignerService,
  ) {}

  async generatePdf(docType: LoanDocumentType, merge: LoanDocumentMergeInput): Promise<{ pdf: Buffer; esigned: boolean }> {
    if (docType !== LOAN_DOCUMENT_TYPE.KEY_FACT) {
      throw new BadRequestException('Only the sanction letter cum Key Fact Statement PDF is generated.');
    }
    const pdf = await this.htmlPdfGenerator.generatePdf(merge);
    return this.signer.sign(pdf);
  }

  pdfFileName(docType: LoanDocumentType): string {
    return LOAN_DOCUMENT_PDF_FILES[docType];
  }
}
