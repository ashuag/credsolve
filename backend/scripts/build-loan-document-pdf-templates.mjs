#!/usr/bin/env node
/**
 * Dev/CI only: convert Word templates to PDF shells (requires LibreOffice on PATH).
 * Runtime uses the generated *.template.pdf + *.fields.json — no LibreOffice in production.
 */
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = path.join(root, 'assets', 'loan-documents', 'templates');

const DOCX = [
  ['key-fact-statement', 'key-fact-statement.docx', 'key-fact-statement.template.pdf'],
  ['loan-agreement', 'loan-agreement.docx', 'loan-agreement.template.pdf'],
];

async function findSoffice() {
  const configured = process.env.LIBREOFFICE_BIN?.trim();
  const candidates = configured ? [configured] : ['soffice', 'libreoffice'];
  for (const bin of candidates) {
    try {
      await execFileAsync(bin, ['--version']);
      return bin;
    } catch {
      // try next
    }
  }
  throw new Error('LibreOffice not found. Install libreoffice-writer or set LIBREOFFICE_BIN.');
}

async function main() {
  const soffice = await findSoffice();
  const outDir = path.join(root, '.tmp-loan-doc-pdf');
  await import('node:fs/promises').then((fs) => fs.mkdir(outDir, { recursive: true }));

  for (const [, docxName, pdfName] of DOCX) {
    const docxPath = path.join(templatesDir, docxName);
    await access(docxPath);
    await execFileAsync(soffice, [
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      outDir,
      docxPath,
    ]);
    const built = path.join(outDir, docxName.replace(/\.docx$/i, '.pdf'));
    const target = path.join(templatesDir, pdfName);
    await import('node:fs/promises').then((fs) => fs.rename(built, target));
    console.log(`Wrote ${path.relative(root, target)}`);
  }

  console.log('\nNext: npm run loan-docs:generate-field-maps');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
