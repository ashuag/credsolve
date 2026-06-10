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

  /**
   * @param digitallySign When true, apply the NBFC (RE) PKCS#7 certificate from CRESAI_PFX_FILE.
   *   Per RBI digital lending norms this should happen on contract execution (customer acceptance),
   *   not on the pre-acceptance preview.
   */
  async generatePdf(
    docType: LoanDocumentType,
    merge: LoanDocumentMergeInput,
    digitallySign = false,
  ): Promise<{ pdf: Buffer; esigned: boolean }> {
    if (docType !== LOAN_DOCUMENT_TYPE.KEY_FACT) {
      throw new BadRequestException('Only the sanction letter cum Key Fact Statement PDF is generated.');
    }

    let preparedMerge = merge;
    if (digitallySign && this.signer.isConfigured()) {
      try {
        const certMeta = await this.signer.readCertificateMetadata();
        preparedMerge = {
          ...merge,
          lenderDscSignerName: this.signer.resolveSigningName(),
          lenderDscSignedAt: merge.lenderDscSignedAt ?? new Date(),
          lenderDscSerial: certMeta.serialNumber,
        };
      } catch {
        // Signing step will log and fall back; still produce the acceptance PDF without a DSC block.
      }
    }

    const pdf = await this.htmlPdfGenerator.generatePdf(preparedMerge);
    if (!digitallySign) {
      return { pdf, esigned: false };
    }
    const htmlStampRendered = Boolean(preparedMerge.lenderDscSerial?.trim());
    return this.signer.sign(pdf, { drawVisualStamp: !htmlStampRendered });
  }

  pdfFileName(docType: LoanDocumentType): string {
    return LOAN_DOCUMENT_PDF_FILES[docType];
  }
}
