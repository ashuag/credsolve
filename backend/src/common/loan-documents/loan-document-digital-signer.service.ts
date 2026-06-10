import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SignPdf, plainAddPlaceholder } from 'node-signpdf';
import {
  LOAN_DOCUMENT_SIGNING_REASON,
  LOAN_DOCUMENT_SIGNATURE_PLACEHOLDER_LENGTH,
  LENDER_SIGNING_CONTACT,
  LENDER_SIGNING_LOCATION,
  LENDER_SIGNING_NAME,
} from '../constants/loan-document.constants';
import { readPfxCertificateMetadata } from './loan-document-pfx-cert.util';
import {
  alignSignatureWidgetRect,
  drawLenderSignatureAppearance,
  lenderSignatureWidgetRect,
} from './loan-document-signature-appearance.util';
import { PDFDocument } from 'pdf-lib';
import {
  applyRfc3161DocumentTimestamp,
  readLoanDocumentTsaOptionsFromEnv,
} from './loan-document-tsa.util';

@Injectable()
export class LoanDocumentDigitalSignerService {
  private readonly logger = new Logger(LoanDocumentDigitalSignerService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('CRESAI_PFX_FILE')?.trim());
  }

  private pfxPath(): string {
    const pfxFile = this.config.get<string>('CRESAI_PFX_FILE')?.trim();
    if (!pfxFile) throw new Error('CRESAI_PFX_FILE is not configured.');
    return path.join(process.cwd(), 'storage', 'digital-signin', pfxFile);
  }

  private pfxPassword(): string {
    // CRESAI_PFX_PASSWORD takes priority; fall back to CRESAI_PASSWORD (same credential store).
    return this.config.get<string>('CRESAI_PFX_PASSWORD') ?? this.config.get<string>('CRESAI_PASSWORD') ?? '';
  }

  private signingName(): string {
    return this.config.get<string>('LOAN_DOCUMENT_SIGN_NAME')?.trim() || LENDER_SIGNING_NAME;
  }

  private signingLocation(): string {
    return this.config.get<string>('LOAN_DOCUMENT_SIGN_LOCATION')?.trim() || LENDER_SIGNING_LOCATION;
  }

  private signingContact(): string {
    return this.config.get<string>('LOAN_DOCUMENT_SIGN_CONTACT')?.trim() || LENDER_SIGNING_CONTACT;
  }

  resolveSigningName(): string {
    return this.signingName();
  }

  async readCertificateMetadata(): Promise<{ serialNumber: string }> {
    const pfxBuffer = await readFile(this.pfxPath());
    return readPfxCertificateMetadata(pfxBuffer, this.pfxPassword());
  }

  async sign(
    pdfBuffer: Buffer,
    options: { drawVisualStamp?: boolean } = {},
  ): Promise<{ pdf: Buffer; esigned: boolean }> {
    const drawVisualStamp = options.drawVisualStamp !== false;
    if (!this.isConfigured()) {
      this.logger.warn(
        '[E-SIGN] CRESAI_PFX_FILE is not set — PDF will NOT carry the NBFC IT Act digital signature.',
      );
      return { pdf: pdfBuffer, esigned: false };
    }

    let pfxBuffer: Buffer;
    try {
      pfxBuffer = await readFile(this.pfxPath());
    } catch (err) {
      this.logger.warn(
        `[E-SIGN] NBFC PFX file not found — PDF will NOT be digitally signed. Reason: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { pdf: pdfBuffer, esigned: false };
    }

    try {
      const signingName = this.signingName();
      const signingLocation = this.signingLocation();
      const signingContact = this.signingContact();
      const passphrase = this.pfxPassword();
      const signedAt = new Date();

      const certMeta = readPfxCertificateMetadata(pfxBuffer, passphrase);

      let pdfForPlaceholder = pdfBuffer;
      let widgetRect: [number, number, number, number];
      if (drawVisualStamp) {
        const drawn = await drawLenderSignatureAppearance(pdfBuffer, {
          signerName: signingName,
          signedAt,
          dscSerial: certMeta.serialNumber,
        });
        pdfForPlaceholder = drawn.pdf;
        widgetRect = drawn.widgetRect;
      } else {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const lastPage = pdfDoc.getPages().at(-1);
        if (!lastPage) {
          throw new Error('Loan document PDF has no pages.');
        }
        const { width: pageWidth } = lastPage.getSize();
        widgetRect = lenderSignatureWidgetRect(pageWidth);
      }

      // plainAddPlaceholder requires classic xref tables; ensure pdf-lib saved with useObjectStreams:false.
      let pdfWithPlaceholder = plainAddPlaceholder({
        pdfBuffer: pdfForPlaceholder,
        reason: LOAN_DOCUMENT_SIGNING_REASON,
        name: signingName,
        location: signingLocation,
        contactInfo: signingContact,
        signatureLength: LOAN_DOCUMENT_SIGNATURE_PLACEHOLDER_LENGTH,
      }) as Buffer;

      pdfWithPlaceholder = alignSignatureWidgetRect(pdfWithPlaceholder, widgetRect);

      const signer = new SignPdf();
      let signed = signer.sign(pdfWithPlaceholder, pfxBuffer, {
        passphrase,
      }) as Buffer;

      this.logger.log(
        `[E-SIGN] PDF digitally signed with visible appearance (name="${signingName}", location="${signingLocation}", dscSerial="${certMeta.serialNumber}").`,
      );

      const tsaOptions = readLoanDocumentTsaOptionsFromEnv(process.env);
      if (tsaOptions) {
        try {
          signed = await applyRfc3161DocumentTimestamp(signed, tsaOptions);
        } catch (err) {
          this.logger.warn(
            `[E-SIGN] RFC-3161 TSA timestamp failed — returning PKCS#7-signed PDF without TSA. Reason: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return { pdf: signed, esigned: true };
    } catch (err) {
      this.logger.error(
        `[E-SIGN] Digital signing FAILED — PDF will NOT be digitally signed. Reason: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { pdf: pdfBuffer, esigned: false };
    }
  }
}
