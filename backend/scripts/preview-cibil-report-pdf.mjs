#!/usr/bin/env node
/**
 * Renders a CIBIL-style PDF from a vendor JSON file (no DB / Nest).
 *
 * Usage:
 *   node scripts/preview-cibil-report-pdf.mjs [json-path] [out-pdf]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const jsonPath = resolve(process.argv[2] ?? 'assets/cibil_samples/30-last-3-months-1.json');
const outPath = resolve(
  process.argv[3] ?? `/tmp/${basename(jsonPath, '.json')}-report.pdf`,
);

async function main() {
  const vendorBody = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const buildDir = resolve('build/src/common/cibil');
  const { extractCibilReportData } = await import(
    pathToFileURL(resolve(buildDir, 'cibil-report-data.extractor.js')).href
  );
  const { buildCibilStyleReportPdf } = await import(
    pathToFileURL(resolve(buildDir, 'cibil-report-pdf-builder.js')).href
  );

  const data = extractCibilReportData(vendorBody);
  data.preApprovedInsight = null;
  const pdf = await buildCibilStyleReportPdf(data);
  writeFileSync(outPath, pdf);
  console.log(`Wrote ${outPath} (${pdf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
