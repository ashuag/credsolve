import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { LOAN_DOCUMENT_HTML_TEMPLATE } from '../constants/loan-document.constants';
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
  return html.replace(/<div class="toolbar">[\s\S]*?<\/div>\s*/i, '');
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
  padding: 0 2px;
}
@media print {
  .page-wrapper { padding-top: 0 !important; }
}
`;
  return html.replace('</style>', `${css}\n</style>`);
}

function fillInputById(html: string, id: string, value: string): string {
  const escaped = escapeHtml(value);
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
  html = stripExternalFonts(html);
  html = stripClientScripts(html);
  html = injectPrintFieldStyles(html);

  const fields = buildLoanDocumentHtmlFieldValues(merge);
  for (const [id, value] of Object.entries(fields)) {
    html = fillInputById(html, id, value);
  }

  return html;
}
