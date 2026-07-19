/**
 * Builds customer legal page JSON from backend/storage/policies/*.txt exports.
 * Run: node scripts/build-legal-content.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const policiesDir = path.resolve(__dirname, '../../backend/storage/policies');
const outDir = path.resolve(__dirname, '../content/legal');

function rebrand(text) {
  return text
    .replaceAll('Moneycash India Private Limited', 'MoneyCash')
    .replaceAll('Moneycash', 'MoneyCash')
    .replaceAll('https://www.moneycash.in/privacy-policy', '/privacy-policy')
    .replaceAll('https://www.moneycash.in', 'https://www.moneycash.in')
    .replaceAll('www.moneycash.in', 'www.moneycash.in')
    .replaceAll('moneycash.in', 'moneycash.in')
    .replaceAll('saurabh@moneycash.in', 'legal@moneycash.in')
    .replace(/\(\s*Hereinafter\s*[“"]MoneyCash[”"]\s*\)/gi, '')
    .replace(/\bMoneycash's\b/g, "MoneyCash's")
    .replace(/\bMoneycash\b/g, 'MoneyCash')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isSectionHeading(paragraph) {
  if (/^\d+\.\d+\./.test(paragraph)) return false;
  const match = paragraph.match(/^(\d+)\.\s+(.+)$/);
  if (!match) return false;
  const title = match[2].trim();
  if (title.length > 120) return false;
  return /^[A-Za-z(]/.test(title);
}

function parseSections(rawText) {
  const lines = rawText
    .split(/\n\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const sections = [];
  let docTitle = lines[0] ?? 'Legal';
  let i = 1;

  if (lines[0] && !isSectionHeading(lines[0])) {
    docTitle = lines[0];
    i = 1;
  }

  let current = null;
  for (; i < lines.length; i += 1) {
    const paragraph = rebrand(lines[i]);
    if (isSectionHeading(paragraph)) {
      if (current) sections.push(current);
      const match = paragraph.match(/^(\d+)\.\s+(.+)$/);
      current = {
        id: match[1],
        title: match[2].trim(),
        paragraphs: [],
      };
      continue;
    }
    if (!current) {
      current = { id: '0', title: 'Introduction', paragraphs: [] };
    }
    current.paragraphs.push(paragraph);
  }
  if (current) sections.push(current);

  return { title: rebrand(docTitle), sections };
}

function buildDoc(sourceFile, slug, meta) {
  const txtPath = path.join(policiesDir, sourceFile);
  const raw = fs.readFileSync(txtPath, 'utf8');
  const parsed = parseSections(raw);
  return {
    slug,
    ...meta,
    ...parsed,
    generatedAt: new Date().toISOString().slice(0, 10),
  };
}

const docs = [
  buildDoc('Terms and Conditions_Moneycash.txt', 'terms-and-conditions', {
    kind: 'terms',
    description:
      'Terms governing use of the MoneyCash website and mobile application, including digital lending services through partner NBFCs.',
    registeredOffice:
      'CREDSOLVE Technologies Private Limited, Flat No. E-2748, Gaur Siddhartham, Siddharth Vihar, Ghaziabad, Uttar Pradesh — 201009',
    contactEmail: 'legal@moneycash.in',
  }),
  buildDoc('Privacy Policy_Moneycash.txt', 'privacy-policy', {
    kind: 'privacy',
    description:
      'How MoneyCash collects, uses, stores, and protects personal information on the website and app.',
    registeredOffice:
      'CREDSOLVE Technologies Private Limited, Flat No. E-2748, Gaur Siddhartham, Siddharth Vihar, Ghaziabad, Uttar Pradesh — 201009',
    contactEmail: 'saurabh@moneycash.in',
    grievanceOfficer: {
      name: 'Mr. saurabh Agarwal',
      email: 'saurabh@moneycash.in',
      phone: '+91-8882911939',
    },
  }),
];

fs.mkdirSync(outDir, { recursive: true });
for (const doc of docs) {
  const outPath = path.join(outDir, `${doc.slug}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`Wrote ${outPath} (${doc.sections.length} sections)`);
}
