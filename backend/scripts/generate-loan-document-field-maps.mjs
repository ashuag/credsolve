#!/usr/bin/env node
/**
 * Regenerates *.fields.json overlay coordinates from *.template.pdf (requires `pdftotext` / poppler).
 */
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = path.join(root, 'assets', 'loan-documents', 'templates');

const MERGE_KEYS = new Set([
  'ADDRESS OF THE BORROWER',
  'ADDRESS',
  'AMOUNT',
  'NAME',
  'BORROWER_NAME',
  'PURPOSE_OF_LOAN',
  'SANCTIONED_AMOUNT',
  'DISBURSED_AMOUNT',
  'LOAN_AMOUNT',
  'INTEREST_RATE',
  'INTEREST_AMOUNT',
  'PROCESSING_FEE',
  'Month',
  'Date',
  'Year',
  'YYYY-MM-DD',
  'DATE',
  'loan term',
  'Loan term',
  'DD-MM-YYYY',
  'mobileNumber',
  'panNumber',
]);

const DOCS = [
  { id: 'key-fact-statement', type: 'key-fact-statement' },
  { id: 'loan-agreement', type: 'loan-agreement' },
];

async function wordsFromPdf(pdfPath) {
  const { stdout: html } = await execFileAsync('pdftotext', ['-bbox', pdfPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 15 * 1024 * 1024,
  });
  const words = [];
  const re =
    /<word[^>]*xMin="([^"]+)"[^>]*yMin="([^"]+)"[^>]*xMax="([^"]+)"[^>]*yMax="([^"]+)"[^>]*>([^<]+)<\/word>/g;
  let m;
  while ((m = re.exec(html))) {
    const [, x0, y0, x1, y1, text] = m;
    words.push({
      text: text.trim(),
      x: Number(x0),
      y: Number(y0),
      width: Number(x1) - Number(x0),
      height: Number(y1) - Number(y0),
    });
  }
  return words;
}

function resolveKey(text, docType) {
  if (text.startsWith('[') && text.includes(']')) {
    return text.slice(text.indexOf('[') + 1, text.indexOf(']'));
  }
  if (docType === 'key-fact-statement') {
    if (text === 'NAME,' || text === 'NAME') return 'NAME';
    if (text === 'ADDRESS') return 'ADDRESS';
    if (text.startsWith('Date') || text === 'Date') return 'DATE';
    if (text === 'DD-MM-YYYY') return 'DD-MM-YYYY';
  }
  return null;
}

function buildOverlays(words, docType) {
  const fields = [];
  for (const w of words) {
    let key = resolveKey(w.text, docType);
    if (!key) continue;
    if (key === 'Date') key = 'Date';
    if (!MERGE_KEYS.has(key) && key !== 'DATE') continue;
    const normalized = key === 'DATE' || w.text.startsWith('Date') ? 'DATE' : key;
    const pad = 2;
    const width =
      normalized === 'ADDRESS' || normalized === 'ADDRESS OF THE BORROWER'
        ? 220
        : normalized === 'NAME'
          ? 160
          : Math.max(w.width + pad * 2, 80);
    fields.push({
      key: normalized,
      page: 0,
      x: Math.round((w.x - pad) * 100) / 100,
      y: Math.round((w.y - pad) * 100) / 100,
      width: Math.round(width * 100) / 100,
      height: Math.round((w.height + pad * 2 + 4) * 100) / 100,
      fontSize: 10,
    });
  }
  return { pageHeight: 842, fields };
}

async function main() {
  for (const { id, type } of DOCS) {
    const pdfPath = path.join(templatesDir, `${id}.template.pdf`);
    const outPath = path.join(templatesDir, `${id}.fields.json`);
    const words = await wordsFromPdf(pdfPath);
    const map = buildOverlays(words, type);
    await writeFile(outPath, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${path.relative(root, outPath)} (${map.fields.length} fields)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
