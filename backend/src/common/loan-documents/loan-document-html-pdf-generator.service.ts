import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';
import { resolvePuppeteerExecutablePath } from '../utils/puppeteer-executable.util';
import { renderLoanDocumentHtml } from './loan-document-html-render.util';
import type { LoanDocumentMergeInput } from './loan-document.types';

@Injectable()
export class LoanDocumentHtmlPdfGeneratorService {
  private readonly logger = new Logger(LoanDocumentHtmlPdfGeneratorService.name);

  async generatePdf(merge: LoanDocumentMergeInput): Promise<Buffer> {
    const html = await renderLoanDocumentHtml(merge);
    let rawPdf: Buffer;
    try {
      rawPdf = await this.htmlToPdfBuffer(html);
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err));
      throw new InternalServerErrorException(
        'Failed to generate loan document PDF from HTML. Ensure Chromium is available (see assets/loan-documents/README.md).',
      );
    }
    return this.normalizePdfForSigning(rawPdf);
  }

  private async htmlToPdfBuffer(html: string): Promise<Buffer> {
    const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    const executablePath = resolvePuppeteerExecutablePath();
    if (configuredPath && !executablePath) {
      this.logger.warn(
        `PUPPETEER_EXECUTABLE_PATH is set to "${configuredPath}" but the binary is missing, not executable, or is a Snap wrapper (use /usr/bin/chromium); falling back to Puppeteer bundled Chromium.`,
      );
    } else if (executablePath) {
      this.logger.debug(`Using Chromium at ${executablePath}`);
    }

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      timeout: 60_000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 120_000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /** Classic xref tables required by node-signpdf. */
  private async normalizePdfForSigning(pdfBuffer: Buffer): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const bytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(bytes);
  }
}
