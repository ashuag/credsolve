import { BadRequestException, Injectable } from '@nestjs/common';
import {
  LOAN_DOCUMENT_PDF_FILES,
  LOAN_DOCUMENT_TYPE,
  LENDER_SIGNING_NAME,
  type LoanDocumentType,
} from '../constants/loan-document.constants';
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
    if (docType !== LOAN_DOCUMENT_TYPE.KEY_FACT && docType !== LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT) {
      throw new BadRequestException('Only the sanction letter cum Key Fact Statement PDF is generated.');
    }

    let preparedMerge = merge;
    if (digitallySign) {
      const signedAt = merge.lenderDscSignedAt ?? merge.acceptanceSignedAt ?? new Date();
      preparedMerge = {
        ...merge,
        lenderDscSignerName: this.signer.isConfigured()
          ? this.signer.resolveSigningName()
          : merge.lenderDscSignerName?.trim() || LENDER_SIGNING_NAME,
        lenderDscSignedAt: signedAt,
      };

      if (this.signer.isConfigured()) {
        try {
          const certMeta = await this.signer.readCertificateMetadata();
          preparedMerge = { ...preparedMerge, lenderDscSerial: certMeta.serialNumber };
        } catch {
          // Signing step will log and fall back; still produce the acceptance PDF without a DSC block.
        }
      }
    }

    const pdf = await this.htmlPdfGenerator.generatePdf(preparedMerge, {
      section: 'sanction-kfs',
      includeAcceptanceBlock: digitallySign,
    });
    if (!digitallySign) {
      return { pdf, esigned: false };
    }
    const htmlStampRendered = Boolean(preparedMerge.lenderDscSignedAt);
    return this.signer.sign(pdf, { drawVisualStamp: !htmlStampRendered });
  }

  async renderPreviewHtml(merge: LoanDocumentMergeInput): Promise<string> {
    return this.htmlPdfGenerator.renderPreviewHtml(merge, {
      section: 'sanction-kfs',
      includeAcceptanceBlock: false,
    });
  }

  /**
   * Loan cum Commercial Terms alone (Section C), plain — no NBFC DSC signature.
   * Generated fresh at send time and attached alongside the sanction letter email;
   * not persisted to storage and not shown in the customer's in-app review/eSign PDF.
   */
  async generateCommercialTermsPdf(merge: LoanDocumentMergeInput): Promise<Buffer> {
    return this.htmlPdfGenerator.generatePdf(merge, { section: 'commercial-terms' });
  }

  pdfFileName(docType: LoanDocumentType): string {
    return LOAN_DOCUMENT_PDF_FILES[docType];
  }
}
