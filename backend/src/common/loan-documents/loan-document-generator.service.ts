import { Injectable } from '@nestjs/common';
import { LOAN_DOCUMENT_PDF_FILES, type LoanDocumentType } from '../constants/loan-document.constants';
import { LoanDocumentPdfGeneratorService } from './loan-document-pdf-generator.service';
import type { LoanDocumentMergeInput } from './loan-document.types';

/** Fills pre-built PDF templates (no LibreOffice / DOCX at runtime). */
@Injectable()
export class LoanDocumentGeneratorService {
  constructor(private readonly pdfGenerator: LoanDocumentPdfGeneratorService) {}

  generatePdf(docType: LoanDocumentType, merge: LoanDocumentMergeInput): Promise<Buffer> {
    return this.pdfGenerator.generatePdf(docType, merge);
  }

  pdfFileName(docType: LoanDocumentType): string {
    return LOAN_DOCUMENT_PDF_FILES[docType];
  }
}
