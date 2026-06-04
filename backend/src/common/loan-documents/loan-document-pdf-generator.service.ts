import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  LOAN_DOCUMENT_TEMPLATE_PDF_FILES,
  LOAN_DOCUMENT_TYPE,
  NBFC_LOGO_FILE,
  type LoanDocumentType,
} from '../constants/loan-document.constants';
import { pdfSafeText } from '../pdf/pdf-safe-text.util';
import { buildLoanDocumentReplacements } from './loan-document-merge-data.util';
import type { LoanDocumentFieldOverlayMap } from './loan-document-field-overlay.types';
import type { LoanDocumentMergeInput } from './loan-document.types';

@Injectable()
export class LoanDocumentPdfGeneratorService {
  private readonly logger = new Logger(LoanDocumentPdfGeneratorService.name);

  templatesDir(): string {
    return path.join(process.cwd(), 'assets', 'loan-documents', 'templates');
  }

  private assetsDir(): string {
    return path.join(process.cwd(), 'assets', 'loan-documents');
  }

  async generatePdf(docType: LoanDocumentType, merge: LoanDocumentMergeInput): Promise<Buffer> {
    const templateName = LOAN_DOCUMENT_TEMPLATE_PDF_FILES[docType];
    const templatePath = path.join(this.templatesDir(), templateName);
    const fieldsPath = path.join(
      this.templatesDir(),
      templateName.replace('.template.pdf', '.fields.json'),
    );

    let templateBytes: Buffer;
    let fieldMap: LoanDocumentFieldOverlayMap;
    try {
      templateBytes = await readFile(templatePath);
      fieldMap = JSON.parse(await readFile(fieldsPath, 'utf8')) as LoanDocumentFieldOverlayMap;
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err));
      throw new InternalServerErrorException(
        `Loan document PDF template missing for "${docType}". See backend/assets/loan-documents/README.md`,
      );
    }

    const replacements = buildLoanDocumentReplacements(merge);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    for (const field of fieldMap.fields) {
      const value = pdfSafeText((replacements[field.key] ?? '').trim());
      if (!value) continue;

      const page = pages[field.page];
      if (!page) continue;

      const fontSize = field.fontSize ?? 10;
      const boxWidth = this.boxWidthFor(field, value);
      const boxHeight = field.height;

      page.drawRectangle({
        x: field.x,
        y: field.y,
        width: boxWidth,
        height: boxHeight,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      });

      page.drawText(value, {
        x: field.x + 2,
        y: field.y + 2,
        size: fontSize,
        font,
        maxWidth: boxWidth - 4,
        lineHeight: fontSize + 2,
        color: rgb(0, 0, 0),
      });
    }

    if (docType === LOAN_DOCUMENT_TYPE.KEY_FACT) {
      await this.embedNbfcLogo(pdfDoc, pages[0]);
      await this.drawSignatureBlock(pdfDoc, pages[pages.length - 1]);
    }

    // useObjectStreams: false produces classic xref tables required by node-signpdf
    const bytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(bytes);
  }

  private async embedNbfcLogo(pdfDoc: PDFDocument, page: ReturnType<PDFDocument['getPages']>[number] | undefined): Promise<void> {
    if (!page) return;
    const logoPath = path.join(this.assetsDir(), NBFC_LOGO_FILE);
    let logoBytes: Buffer;
    try {
      logoBytes = await readFile(logoPath);
    } catch {
      this.logger.warn(`NBFC logo not found at ${logoPath}; skipping logo embed.`);
      return;
    }
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImage.scaleToFit(110, 55);
    page.drawImage(logoImage, {
      x: 30,
      y: 775,
      width: logoDims.width,
      height: logoDims.height,
    });
  }

  private async drawSignatureBlock(
    pdfDoc: PDFDocument,
    page: ReturnType<PDFDocument['getPages']>[number] | undefined,
  ): Promise<void> {
    if (!page) return;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStr = `${dd}-${mm}-${yyyy}`;

    // Block sits at bottom-left of the page
    const bx = 30;
    const by = 28;
    const bw = 250;
    const bh = 62;

    // Outer border
    page.drawRectangle({
      x: bx,
      y: by,
      width: bw,
      height: bh,
      borderColor: rgb(0.13, 0.32, 0.24),
      borderWidth: 0.8,
      color: rgb(0.96, 0.99, 0.97),
    });

    // Header bar
    page.drawRectangle({
      x: bx,
      y: by + bh - 14,
      width: bw,
      height: 14,
      color: rgb(0.13, 0.32, 0.24),
    });

    page.drawText('DIGITALLY SIGNED', {
      x: bx + 6,
      y: by + bh - 10.5,
      size: 7,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    const lines = [
      { label: 'By', value: 'AASRA FINCORP PRIVATE LIMITED' },
      { label: 'DN', value: 'DS AASRA FINCORP PRIVATE LIMITED 1' },
      { label: 'Date', value: dateStr },
    ];

    lines.forEach((line, i) => {
      const y = by + bh - 24 - i * 13;
      page.drawText(`${line.label}:`, { x: bx + 6, y, size: 6.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(line.value, { x: bx + 22, y, size: 6.5, font, color: rgb(0.1, 0.1, 0.1), maxWidth: bw - 28 });
    });
  }

  /** Wider boxes for long borrower names and addresses. */
  private boxWidthFor(
    field: { key: string; width: number },
    value: string,
  ): number {
    const amountKeys = new Set([
      'AMOUNT',
      'SANCTIONED_AMOUNT',
      'DISBURSED_AMOUNT',
      'LOAN_AMOUNT',
      'INTEREST_AMOUNT',
      'PROCESSING_FEE',
    ]);
    const minByKey =
      field.key === 'ADDRESS' || field.key === 'ADDRESS OF THE BORROWER'
        ? 220
        : field.key === 'NAME' || field.key === 'BORROWER_NAME'
          ? 160
          : field.key === 'PURPOSE_OF_LOAN'
            ? 140
            : field.key === 'INTEREST_RATE'
              ? 120
              : amountKeys.has(field.key)
                ? 100
                : field.width;
    const est = Math.min(360, Math.max(minByKey, value.length * 5.5));
    return Math.max(field.width, est);
  }
}
