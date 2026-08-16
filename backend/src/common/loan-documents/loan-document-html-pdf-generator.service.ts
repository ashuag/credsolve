import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { accessSync, constants, existsSync } from 'node:fs';
import puppeteer from 'puppeteer';
import { resolvePuppeteerExecutablePath } from '../utils/puppeteer-executable.util';
import { renderLoanDocumentHtml, type LoanDocumentRenderOptions } from './loan-document-html-render.util';
import type { LoanDocumentMergeInput } from './loan-document.types';
import { BounceChargeTierResolverService } from '../loan/bounce-charge-tier.resolver';

@Injectable()
export class LoanDocumentHtmlPdfGeneratorService {
  private readonly logger = new Logger(LoanDocumentHtmlPdfGeneratorService.name);
  /** One Chromium at a time — parallel launches OOM the Docker VM and can kill sibling containers. */
  private chromiumTail: Promise<unknown> = Promise.resolve();

  constructor(private readonly bounceChargeTiers: BounceChargeTierResolverService) {}

  async generatePdf(
    merge: LoanDocumentMergeInput,
    options: LoanDocumentRenderOptions = {},
  ): Promise<Buffer> {
    const needsTiers = merge.bounceChargeTiers == null;
    const needsPenal = merge.penalCharges == null;
    const context =
      needsTiers || needsPenal ? await this.bounceChargeTiers.loadContext() : null;

    const html = await renderLoanDocumentHtml(
      {
        ...merge,
        bounceChargeTiers: merge.bounceChargeTiers ?? context?.tiers,
        penalCharges: merge.penalCharges ?? context?.penal,
      },
      options,
    );
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

  private resolveLaunchExecutablePath(): string | undefined {
    const systemPath = resolvePuppeteerExecutablePath();
    if (systemPath) return systemPath;

    try {
      const bundled = puppeteer.executablePath();
      if (bundled && existsSync(bundled)) {
        try {
          accessSync(bundled, constants.X_OK);
          return bundled;
        } catch {
          /* not executable */
        }
      }
    } catch {
      /* bundled browser not installed */
    }

    return undefined;
  }

  private async htmlToPdfBuffer(html: string): Promise<Buffer> {
    const run = this.chromiumTail.then(() => this.renderHtmlWithChromium(html));
    this.chromiumTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async renderHtmlWithChromium(html: string): Promise<Buffer> {
    const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    const executablePath = this.resolveLaunchExecutablePath();
    if (configuredPath && !executablePath) {
      this.logger.warn(
        `PUPPETEER_EXECUTABLE_PATH is set to "${configuredPath}" but the binary is missing, not executable, or is a Snap wrapper (use /usr/bin/chromium); falling back to Puppeteer bundled Chromium.`,
      );
    } else if (executablePath) {
      this.logger.debug(`Using Chromium at ${executablePath}`);
    } else {
      this.logger.error(
        'No Chromium/Chrome binary found. Run: npm run loan-docs:setup-chromium (VPS) or rebuild the backend Docker container.',
      );
    }

    const browser = await puppeteer.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
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
