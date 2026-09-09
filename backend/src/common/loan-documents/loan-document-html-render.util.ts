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

/** Removes a whole `<div class="doc-section" id="{id}">…</div><!-- /{id} -->` block, if present. */
function removeSectionById(html: string, id: string): string {
  const pattern = new RegExp(
    `<div class="doc-section" id="${id}">[\\s\\S]*?</div><!--\\s*/${id}\\s*-->\\s*`,
    'i',
  );
  return html.replace(pattern, '');
}

function stripExternalFonts(html: string): string {
  return html
    .replace(/<link rel="preconnect"[^>]*>\s*/gi, '')
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/gi, '');
}

function stripClientScripts(html: string): string {
  return html.replace(/<script>[\s\S]*?<\/script>\s*/gi, '');
}

function injectOnScreenPreviewStyles(html: string): string {
  const css = `
html, body { background: #fff !important; }
.page-wrapper { padding: 8px 4px 28px !important; }
.document { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
.doc-section { padding: 22px 16px 18px !important; }
table { width: 100% !important; max-width: 100% !important; }
img { max-width: 100% !important; height: auto !important; }
`;
  return html.replace('</style>', `${css}\n</style>`);
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

/**
 * `sanction-kfs` — Sanction Letter + KFS (Sections A+B), the document the customer reviews
 *   and eSigns in-app. `commercial-terms` — Loan cum Commercial Terms (Section C) alone,
 *   generated only to attach to the post-acceptance sanction-letter email.
 * `disbursement` — A+B (+ acceptance) + C in one PDF, emailed at disbursement.
 */
export type LoanDocumentRenderSection = 'sanction-kfs' | 'commercial-terms' | 'disbursement';

export type LoanDocumentRenderOptions = {
  section?: LoanDocumentRenderSection;
  /** Include the borrower eSign / NBFC DSC block. Set once acceptance has happened. */
  includeAcceptanceBlock?: boolean;
  /** Extra CSS for in-app mobile/desktop reading (not used when printing to PDF). */
  onScreenPreview?: boolean;
};

export async function renderLoanDocumentHtml(
  merge: LoanDocumentMergeInput,
  options: LoanDocumentRenderOptions = {},
): Promise<string> {
  const section = options.section ?? 'sanction-kfs';
  const templatePath = path.join(loanDocumentTemplatesDir(), LOAN_DOCUMENT_HTML_TEMPLATE);
  let html = await readFile(templatePath, 'utf8');

  html = stripToolbar(html);
  html = stripPageBreakMarkers(html);
  html = stripExternalFonts(html);
  html = stripClientScripts(html);
  html = injectPrintFieldStyles(html);
  if (options.onScreenPreview) {
    html = injectOnScreenPreviewStyles(html);
  }

  if (section === 'commercial-terms') {
    html = removeSectionById(html, 'sec-a');
    html = removeSectionById(html, 'sec-b');
    html = removeSectionById(html, 'sec-close');
  } else {
    if (section !== 'disbursement') {
      html = removeSectionById(html, 'sec-c');
    }
    if (!options.includeAcceptanceBlock) {
      html = removeSectionById(html, 'sec-close');
    }
  }

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
