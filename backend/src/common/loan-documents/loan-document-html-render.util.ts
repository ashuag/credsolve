import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { LOAN_DOCUMENT_HTML_TEMPLATE, LENDER_LOGO_FILE } from '../constants/loan-document.constants';
import {
  DEFAULT_PENAL_CHARGE_CONFIG,
  formatPenalChargeDisplay,
  renderBounceChargeTierHtmlRows,
} from '../loan/bounce-charge.util';
import { buildLoanDocumentHtmlFieldValues } from './loan-document-html-field-map.util';
import type { LoanDocumentMergeInput } from './loan-document.types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripToolbar(html: string): string {
  return html.replace(/<div class="toolbar">[\s\S]*?(?=<div class="page-wrapper">)/i, '');
}

function stripPageBreakMarkers(html: string): string {
  return html.replace(/<div class="page-break"[\s\S]*?<\/div>\s*/gi, '');
}

function stripExternalFonts(html: string): string {
  return html
    .replace(/<link rel="preconnect"[^>]*>\s*/gi, '')
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/gi, '');
}

function stripClientScripts(html: string): string {
  return html.replace(/<script>[\s\S]*?<\/script>\s*/gi, '');
}

function injectPrintFieldStyles(html: string): string {
  const css = `
.filled-val {
  display: inline;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  border: none;
  background: transparent;
  padding: 0;
}
@media print {
  .page-wrapper { padding: 0 !important; }
}
.page-wrapper { padding: 0 !important; }
`;
  return html.replace('</style>', `${css}\n</style>`);
}

/** Replace the text of every `<span data-{attr}>…</span>` marker (values repeat across clauses). */
function fillSpanByDataAttr(html: string, attr: string, value: string): string {
  const pattern = new RegExp(`(<span\\b[^>]*\\b${attr}\\b[^>]*>)[\\s\\S]*?(</span>)`, 'gi');
  return html.replace(pattern, `$1${escapeHtml(value)}$2`);
}

function fillInputById(html: string, id: string, value: string): string {
  const escaped = escapeHtml(value.trim());
  const span = `<span class="filled-val" data-field="${id}">${escaped}</span>`;
  const pattern = new RegExp(
    `<input\\b(?=[^>]*\\bid="${id}"[^>]*)(?:(?!>).)*>`,
    'i',
  );
  return html.replace(pattern, span);
}

export function loanDocumentTemplatesDir(): string {
  return path.join(process.cwd(), 'assets', 'loan-documents', 'templates');
}

export async function renderLoanDocumentHtml(merge: LoanDocumentMergeInput): Promise<string> {
  const templatePath = path.join(loanDocumentTemplatesDir(), LOAN_DOCUMENT_HTML_TEMPLATE);
  let html = await readFile(templatePath, 'utf8');

  html = stripToolbar(html);
  html = stripPageBreakMarkers(html);
  html = stripExternalFonts(html);
  html = stripClientScripts(html);
  html = injectPrintFieldStyles(html);

  const fields = buildLoanDocumentHtmlFieldValues(merge);
  for (const [id, value] of Object.entries(fields)) {
    html = fillInputById(html, id, value);
  }

  // Section A uses `input#sl_penal_*`; Table II and clause 7 repeat the same values as prose.
  const penal = formatPenalChargeDisplay(merge.penalCharges ?? DEFAULT_PENAL_CHARGE_CONFIG);
  html = fillSpanByDataAttr(html, 'data-penal-rate', penal.ratePercent);
  html = fillSpanByDataAttr(html, 'data-penal-min', penal.minInr);
  html = fillSpanByDataAttr(html, 'data-penal-max', penal.maxInr);

  if (merge.bounceChargeTiers != null && merge.bounceChargeTiers.length > 0) {
    const rows = renderBounceChargeTierHtmlRows(merge.bounceChargeTiers);
    html = html.replace(
      /<tbody\b([^>]*\bdata-bounce-charge-tiers\b[^>]*)>[\s\S]*?<\/tbody>/gi,
      `<tbody$1>\n      ${rows}\n    </tbody>`,
    );
  }

  if (fields.lender_dsc_date || fields.lender_dsc_serial) {
    html = html.replace('class="lender-dsc-stamp-wrap hidden"', 'class="lender-dsc-stamp-wrap"');

    if (!fields.lender_dsc_serial) {
      html = html.replace(/<div class="lender-dsc-line">DSC Serial:[\s\S]*?<\/div>\s*/i, '');
      html = html.replace('<div class="lender-dsc-legal">Valid under the IT Act, 2000</div>', '');
      html = html.replace('Digitally signed by', 'Authorized by');
    }
  }

  html = await injectLenderDscLogo(html);

  return html;
}

async function injectLenderDscLogo(html: string): Promise<string> {
  try {
    const logoPath = path.join(process.cwd(), 'assets', 'loan-documents', LENDER_LOGO_FILE);
    const logoBytes = await readFile(logoPath);
    const dataUri = `data:image/png;base64,${logoBytes.toString('base64')}`;
    return html
      .replaceAll('__LENDER_DSC_LOGO_SRC__', dataUri)
      .replaceAll('__LENDER_LOGO_SRC__', dataUri);
  } catch {
    return html
      .replaceAll('__LENDER_DSC_LOGO_SRC__', '')
      .replaceAll('__LENDER_LOGO_SRC__', '');
  }
}
