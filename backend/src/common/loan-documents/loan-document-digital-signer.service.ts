import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SignPdf, plainAddPlaceholder } from 'node-signpdf';

@Injectable()
export class LoanDocumentDigitalSignerService {
  private readonly logger = new Logger(LoanDocumentDigitalSignerService.name);

  constructor(private readonly config: ConfigService) {}

  private pfxPath(): string {
    const pfxFile = this.config.get<string>('CRESAI_PFX_FILE');
    if (!pfxFile) throw new Error('CRESAI_PFX_FILE is not configured.');
    return path.join(process.cwd(), 'storage', 'digital-signin', pfxFile);
  }

  private pfxPassword(): string {
    // CRESAI_PFX_PASSWORD takes priority; fall back to CRESAI_PASSWORD (same credential store).
    return this.config.get<string>('CRESAI_PFX_PASSWORD') ?? this.config.get<string>('CRESAI_PASSWORD') ?? '';
  }

  async sign(pdfBuffer: Buffer): Promise<{ pdf: Buffer; esigned: boolean }> {
    let pfxBuffer: Buffer;
    try {
      pfxBuffer = await readFile(this.pfxPath());
    } catch (err) {
      this.logger.warn(
        `[E-SIGN] PFX file not found — PDF will NOT be digitally signed. Reason: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { pdf: pdfBuffer, esigned: false };
    }

    try {
      // plainAddPlaceholder requires classic xref tables; ensure pdf-lib saved with useObjectStreams:false.
      const pdfWithPlaceholder = plainAddPlaceholder({
        pdfBuffer,
        reason: 'Loan Sanction Letter cum Key Fact Statement',
        signatureLength: 8192,
      }) as Buffer;

      const signer = new SignPdf();
      const signed = signer.sign(pdfWithPlaceholder, pfxBuffer, {
        passphrase: this.pfxPassword(),
      }) as Buffer;

      this.logger.log('[E-SIGN] PDF digitally signed successfully using PKCS#7 / PFX certificate.');
      return { pdf: signed, esigned: true };
    } catch (err) {
      this.logger.error(
        `[E-SIGN] Digital signing FAILED — PDF will NOT be digitally signed. Reason: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { pdf: pdfBuffer, esigned: false };
    }
  }
}
