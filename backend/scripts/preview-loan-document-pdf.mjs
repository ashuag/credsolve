import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const { renderLoanDocumentHtml } = await import('../build/src/common/loan-documents/loan-document-html-render.util.js');
const puppeteer = (await import('puppeteer')).default;
const { PDFDocument } = await import('pdf-lib');

const merge = {
  fullName: 'Rahul Kumar Sharma',
  mobileNumber: '9876543210',
  panNumber: 'ABCDE1234F',
  addressLine1: '12 MG Road',
  addressLine2: 'Near City Mall',
  currentCity: 'Ghaziabad',
  pincode: '201009',
  loanAmountInr: '10000',
  loanPurpose: 'Personal',
  interestRatePerDayPercent: '1',
  interestAmountInr: '280',
  processingFeeAmountInr: '1200',
  gstAmountInr: '216',
  loanTenureDays: 28,
  loanMaturityDate: new Date(),
  applicationUuid: '00000000-0000-4000-8000-000000000001',
  processingFeePercent: 12,
  asOf: new Date(),
};

const html = await renderLoanDocumentHtml(merge);
const outDir = path.join(root, 'storage', 'local', 'preview');
const htmlPath = path.join(outDir, 'loan-document-preview.html');
const pdfPath = path.join(outDir, 'loan-document-preview.pdf');

await writeFile(htmlPath, html, 'utf8');

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const raw = await page.pdf({ format: 'A4', printBackground: true });
  const pdfDoc = await PDFDocument.load(raw);
  const normalized = await pdfDoc.save({ useObjectStreams: false });
  await writeFile(pdfPath, Buffer.from(normalized));
} finally {
  await browser.close();
}

console.log(`Wrote ${htmlPath}`);
console.log(`Wrote ${pdfPath}`);
