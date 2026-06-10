import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { LENDER_LOGO_FILE, LENDER_SIGNING_NAME } from '../constants/loan-document.constants';

/** Visible NBFC DSC stamp dimensions (PDF points, bottom-left origin). */
export const LENDER_SIGNATURE_STAMP_SIZE = {
  width: 242,
  height: 82,
  marginRight: 28,
  marginBottom: 36,
} as const;

export type LenderSignatureStampRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LenderSignatureAppearanceInput = {
  signerName: string;
  signedAt: Date;
  dscSerial: string;
};

export type LenderSignatureAppearanceResult = {
  pdf: Buffer;
  widgetRect: [number, number, number, number];
};

export function resolveLenderSignatureStampRect(pageWidth: number): LenderSignatureStampRect {
  const { width, height, marginRight, marginBottom } = LENDER_SIGNATURE_STAMP_SIZE;
  return {
    x: Math.max(marginRight, pageWidth - width - marginRight),
    y: marginBottom,
    width,
    height,
  };
}

export function lenderSignatureWidgetRect(pageWidth: number): [number, number, number, number] {
  const { x, y, width, height } = resolveLenderSignatureStampRect(pageWidth);
  return [x, y, x + width, y + height];
}

function formatStampDate(value: Date): string {
  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(value)} IST`;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

async function tryEmbedLenderLogo(
  pdfDoc: PDFDocument,
  page: PDFPage,
  rect: LenderSignatureStampRect,
): Promise<void> {
  try {
    const logoPath = path.join(process.cwd(), 'assets', 'loan-documents', LENDER_LOGO_FILE);
    const logoBytes = await readFile(logoPath);
    const logo = await pdfDoc.embedPng(logoBytes);
    const logoSize = 34;
    page.drawImage(logo, {
      x: rect.x + 8,
      y: rect.y + 24,
      width: logoSize,
      height: logoSize,
    });
  } catch {
    // Logo is optional; stamp still renders without it.
  }
}

export async function drawLenderSignatureAppearance(
  pdfBuffer: Buffer,
  input: LenderSignatureAppearanceInput,
): Promise<LenderSignatureAppearanceResult> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const page = pages[pages.length - 1];
  if (!page) {
    throw new Error('Loan document PDF has no pages.');
  }

  const { width: pageWidth } = page.getSize();
  const rect = resolveLenderSignatureStampRect(pageWidth);
  const widgetRect = lenderSignatureWidgetRect(pageWidth);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { x, y, width, height } = rect;
  const textX = x + 48;
  const teal = rgb(0, 0.545, 0.576);
  const ink = rgb(0.12, 0.16, 0.2);
  const muted = rgb(0.35, 0.4, 0.45);

  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: teal,
    borderWidth: 1.2,
    color: rgb(0.97, 0.99, 0.99),
  });

  await tryEmbedLenderLogo(pdfDoc, page, rect);

  const signerName = truncateText(input.signerName.trim() || LENDER_SIGNING_NAME, 34);
  const serial = truncateText(input.dscSerial.trim(), 28);
  const signedAt = formatStampDate(input.signedAt);

  page.drawText('Digitally signed by', { x: textX, y: y + 62, size: 7, font, color: muted });
  page.drawText(signerName, { x: textX, y: y + 50, size: 9, font: fontBold, color: ink });
  page.drawText(`Date: ${signedAt}`, { x: textX, y: y + 36, size: 7.5, font, color: ink });
  page.drawText(`DSC Serial: ${serial}`, { x: textX, y: y + 24, size: 7.5, font, color: ink });
  page.drawText('Valid under the IT Act, 2000', { x: textX, y: y + 10, size: 6.5, font, color: muted });

  const bytes = await pdfDoc.save({ useObjectStreams: false });
  return { pdf: Buffer.from(bytes), widgetRect };
}

/** node-signpdf v2 creates an invisible widget; align it with the drawn stamp. */
export function alignSignatureWidgetRect(pdfBuffer: Buffer, rect: [number, number, number, number]): Buffer {
  const needle = '/Rect [0 0 0 0]';
  const idx = pdfBuffer.lastIndexOf(needle);
  if (idx === -1) {
    throw new Error('Signature widget placeholder rect not found in PDF.');
  }
  const rectValue = `[${rect.map((n) => Number(n.toFixed(2))).join(' ')}]`;
  return Buffer.concat([
    pdfBuffer.subarray(0, idx),
    Buffer.from(`/Rect ${rectValue}`, 'latin1'),
    pdfBuffer.subarray(idx + needle.length),
  ]);
}
