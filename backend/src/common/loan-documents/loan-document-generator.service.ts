import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  LOAN_DOCUMENT_PDF_FILES,
  LOAN_DOCUMENT_TEMPLATE_FILES,
  type LoanDocumentType,
} from '../constants/loan-document.constants';
import { applyReplacementsToXml, buildLoanDocumentReplacements } from './loan-document-merge-data.util';
import type { LoanDocumentMergeInput } from './loan-document.types';

const execFileAsync = promisify(execFile);

function isMissingCommandError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const rec = err as { code?: unknown };
  return rec.code === 'ENOENT';
}

@Injectable()
export class LoanDocumentGeneratorService {
  private readonly logger = new Logger(LoanDocumentGeneratorService.name);

  templatesDir(): string {
    return path.join(process.cwd(), 'assets', 'loan-documents', 'templates');
  }

  async generatePdf(docType: LoanDocumentType, merge: LoanDocumentMergeInput): Promise<Buffer> {
    const templateName = LOAN_DOCUMENT_TEMPLATE_FILES[docType];
    const templatePath = path.join(this.templatesDir(), templateName);
    const workDir = await mkdtemp(path.join(tmpdir(), 'mc-loan-doc-'));

    try {
      const filledDocx = path.join(workDir, 'filled.docx');
      await this.fillDocxTemplate(templatePath, filledDocx, merge);
      const pdfPath = await this.convertDocxToPdf(filledDocx, workDir);
      return await readFile(pdfPath);
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  pdfFileName(docType: LoanDocumentType): string {
    return LOAN_DOCUMENT_PDF_FILES[docType];
  }

  private async fillDocxTemplate(
    templatePath: string,
    outputDocxPath: string,
    merge: LoanDocumentMergeInput,
  ): Promise<void> {
    const extractDir = path.join(path.dirname(outputDocxPath), 'docx_extract');
    try {
      await execFileAsync('unzip', ['-q', templatePath, '-d', extractDir]);
    } catch (err) {
      if (isMissingCommandError(err)) {
        throw new InternalServerErrorException(
          'DOCX prefill requires unzip/zip in backend container. Install: unzip zip',
        );
      }
      throw err;
    }

    const documentXmlPath = path.join(extractDir, 'word', 'document.xml');
    const xml = await readFile(documentXmlPath, 'utf8');
    const replacements = buildLoanDocumentReplacements(merge);
    const filled = applyReplacementsToXml(xml, replacements);
    await writeFile(documentXmlPath, filled, 'utf8');

    try {
      await execFileAsync('zip', ['-q', '-r', outputDocxPath, '.'], { cwd: extractDir });
    } catch (err) {
      if (isMissingCommandError(err)) {
        throw new InternalServerErrorException(
          'DOCX prefill requires unzip/zip in backend container. Install: unzip zip',
        );
      }
      throw err;
    }
  }

  private async convertDocxToPdf(docxPath: string, outDir: string): Promise<string> {
    const base = path.basename(docxPath, '.docx');
    const pdfPath = path.join(outDir, `${base}.pdf`);
    const configuredBin = process.env.LIBREOFFICE_BIN?.trim();
    const binaries = configuredBin ? [configuredBin] : ['soffice', 'libreoffice'];

    for (const bin of binaries) {
      try {
        await execFileAsync(
          bin,
          [
            '--headless',
            '--invisible',
            '--nodefault',
            '--nolockcheck',
            '--nologo',
            '--nofirststartwizard',
            `-env:UserInstallation=file://${path.join(outDir, 'lo-profile')}`,
            '--convert-to',
            'pdf',
            '--outdir',
            outDir,
            docxPath,
          ],
          {
            env: {
              ...process.env,
              HOME: outDir,
              TMPDIR: outDir,
            },
          },
        );
      } catch (err) {
        // Some LibreOffice builds still emit non-zero while producing output.
        this.logger.warn(
          `LibreOffice conversion command failed with ${bin}; checking output anyway.`,
        );
        this.logger.warn(err instanceof Error ? err.message : String(err));
      }

      try {
        await readFile(pdfPath);
        return pdfPath;
      } catch {
        // try next binary
      }
    }

    throw new InternalServerErrorException(
      'Could not generate loan document PDF. Ensure LibreOffice/soffice is installed in the backend container.',
    );
  }
}
