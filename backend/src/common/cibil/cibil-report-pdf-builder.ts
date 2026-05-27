import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage, type PDFFont } from 'pdf-lib';
import { pdfSafeText } from '../pdf/pdf-safe-text.util';
import { formatControlNumberDisplay } from './cibil-report-data.extractor';
import type {
  CibilReportAccountRow,
  CibilReportData,
  CibilReportInquiryRow,
  CibilReportPaymentMonth,
  CibilReportScoreFactor,
} from './cibil-report-data.extractor';

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

const CIBIL_TEAL = rgb(0.32, 0.63, 0.67);
const OPEN_GREEN = rgb(0.12, 0.55, 0.28);
const BORDER = rgb(0.86, 0.88, 0.9);
const LABEL = rgb(0.45, 0.48, 0.52);
const TEXT = rgb(0.15, 0.17, 0.2);
const MUTED = rgb(0.4, 0.42, 0.46);
const GAUGE_ORANGE = rgb(0.95, 0.55, 0.2);
const GAUGE_YELLOW = rgb(0.98, 0.82, 0.2);
const GAUGE_GREEN = rgb(0.2, 0.7, 0.35);

const MONTH_COLS = ['Dec', 'Nov', 'Oct', 'Sep', 'Aug', 'Jul', 'Jun', 'May', 'Apr', 'Mar', 'Feb', 'Jan'] as const;

const MONEYCASH_LOGO_PATH = path.join(
  process.cwd(),
  'assets',
  'loan-documents',
  'moneycash-logo.png',
);

const HEADER_LOGO_HEIGHT = 44;

type Fonts = { regular: PDFFont; bold: PDFFont };

async function embedMoneyCashLogo(pdf: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = readFileSync(MONEYCASH_LOGO_PATH);
    return pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

export async function buildCibilStyleReportPdf(data: CibilReportData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await embedMoneyCashLogo(pdf);

  const ctx = new PdfCanvas(pdf, fonts, logo);
  drawPrintHeader(ctx, data);
  drawScoreSection(ctx, data);
  drawCreditInsights(ctx, data);
  drawPreApprovedInsight(ctx, data);
  drawPersonalDetails(ctx, data);
  drawIdentificationDetails(ctx, data);
  drawAddressDetails(ctx, data);
  drawContactDetails(ctx, data);
  drawEmailDetails(ctx, data);
  drawEmploymentDetails(ctx, data);
  drawAccountsSummary(ctx, data);
  drawAllAccounts(ctx, data);
  drawEnquiryDetails(ctx, data.inquiries);
  drawReportFooter(ctx, data);

  return pdf.save();
}

class PdfCanvas {
  page: PDFPage;
  y = PAGE_H - MARGIN;

  constructor(
    readonly pdf: PDFDocument,
    readonly fonts: Fonts,
    readonly logo: PDFImage | null = null,
  ) {
    this.page = pdf.addPage([PAGE_W, PAGE_H]);
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  ensure(needed: number) {
    if (this.y - needed >= MARGIN + 24) return;
    this.newPage();
  }

  drawText(
    value: string,
    x: number,
    y: number,
    size: number,
    opts?: { bold?: boolean; color?: ReturnType<typeof rgb>; maxWidth?: number },
  ) {
    const font = opts?.bold ? this.fonts.bold : this.fonts.regular;
    const color = opts?.color ?? TEXT;
    const safe = pdfSafeText(value);
    const lines = opts?.maxWidth ? wrap(safe, opts.maxWidth, size, font) : [safe];
    let cy = y;
    for (const line of lines) {
      this.page.drawText(line, { x, y: cy, size, font, color });
      cy -= size + 3;
    }
    return cy;
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: BORDER });
  }

  tealHeader(title: string) {
    this.ensure(22);
    this.y -= 4;
    this.y = this.drawText(title, MARGIN, this.y, 11, { bold: true, color: CIBIL_TEAL });
    this.y -= 6;
  }

  /** Label (left) | value (right) rows like CIBIL print view. */
  stripedRows(rows: Array<{ label: string; value: string }>) {
    for (const row of rows) {
      this.ensure(16);
      const rowH = 14;
      const baseY = this.y - rowH;
      this.line(MARGIN, baseY, PAGE_W - MARGIN, baseY);
      this.page.drawText(pdfSafeText(row.label), {
        x: MARGIN + 4,
        y: baseY + 3,
        size: 8,
        font: this.fonts.regular,
        color: LABEL,
      });
      const val = wrap(pdfSafeText(row.value), CONTENT_W * 0.55, 8, this.fonts.regular)[0] ?? '-';
      this.page.drawText(val, {
        x: PAGE_W - MARGIN - 4 - this.fonts.regular.widthOfTextAtSize(val, 8),
        y: baseY + 3,
        size: 8,
        font: this.fonts.regular,
        color: TEXT,
      });
      this.y = baseY - 2;
    }
    this.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y -= 8;
  }

  dataTable(headers: string[], rows: string[][], colWidths: number[]) {
    const tableW = colWidths.reduce((a, b) => a + b, 0);
    let x0 = MARGIN;

    this.ensure(18 + rows.length * 14);
    headers.forEach((h, i) => {
      this.page.drawText(pdfSafeText(h.toUpperCase()), {
        x: x0 + 4,
        y: this.y,
        size: 7,
        font: this.fonts.bold,
        color: LABEL,
      });
      x0 += colWidths[i];
    });
    this.y -= 12;
    this.line(MARGIN, this.y, MARGIN + tableW, this.y);
    this.y -= 6;

    for (const row of rows) {
      this.ensure(14);
      let cx = MARGIN;
      const baseY = this.y - 12;
      row.forEach((cell, i) => {
        const line = wrap(pdfSafeText(cell), colWidths[i] - 8, 7.5, this.fonts.regular)[0] ?? '-';
        this.page.drawText(line, {
          x: cx + 4,
          y: baseY,
          size: 7.5,
          font: this.fonts.regular,
          color: TEXT,
        });
        cx += colWidths[i];
      });
      this.line(MARGIN, baseY - 2, MARGIN + tableW, baseY - 2);
      this.y = baseY - 6;
    }
    this.y -= 4;
  }
}

function drawPrintHeader(ctx: PdfCanvas, data: CibilReportData) {
  const headerTop = PAGE_H - 46;
  let textX = MARGIN;
  let blockBottom = headerTop - 36;

  if (ctx.logo) {
    const scale = HEADER_LOGO_HEIGHT / ctx.logo.height;
    const logoW = ctx.logo.width * scale;
    const logoY = headerTop - HEADER_LOGO_HEIGHT;
    ctx.page.drawImage(ctx.logo, {
      x: MARGIN,
      y: logoY,
      width: logoW,
      height: HEADER_LOGO_HEIGHT,
    });
    textX = MARGIN + logoW + 12;
    blockBottom = Math.min(blockBottom, logoY - 4);
  }

  const titleY = headerTop - 4;
  ctx.drawText('CIBIL', textX, titleY, 18, { bold: true, color: CIBIL_TEAL });
  ctx.drawText('CIBIL Score & Report', textX, titleY - 22, 11, { bold: true, color: TEXT });
  blockBottom = Math.min(blockBottom, titleY - 38);

  const control = formatControlNumberDisplay(data.controlNumber) ?? '-';
  const dateStr = data.reportDateDisplay ?? data.bureauInquiryDate ?? '-';
  ctx.drawText(`Control Number: ${control}`, PAGE_W - MARGIN - 160, PAGE_H - 42, 8, {
    color: MUTED,
    maxWidth: 160,
  });
  ctx.drawText(`Date: ${dateStr}`, PAGE_W - MARGIN - 160, PAGE_H - 54, 8, { color: MUTED, maxWidth: 160 });

  ctx.y = blockBottom - 16;
}

function drawScoreSection(ctx: PdfCanvas, data: CibilReportData) {
  const score = data.cibilScore ?? 0;
  const gaugeY = ctx.y - 8;
  drawSemiCircularGauge(ctx, MARGIN + 8, gaugeY, 70, score);

  const textX = MARGIN + 130;
  let ty = gaugeY - 6;
  ty = ctx.drawText(`Hello, ${data.consumerName}`, textX, ty, 11, { bold: true });
  const asOf = data.reportDateDisplay ?? '-';
  ty = ctx.drawText(
    `Your CIBIL Score is ${data.cibilScore ?? 'N/A'} as of Date : ${asOf}`,
    textX,
    ty - 4,
    10,
    { bold: true, maxWidth: CONTENT_W - 130 },
  );
  if (data.scoreRatingLabel) {
    ty = ctx.drawText(`Rating: ${data.scoreRatingLabel}`, textX, ty - 4, 9, {
      bold: true,
      color: OPEN_GREEN,
      maxWidth: CONTENT_W - 130,
    });
  }
  const meta: string[] = [];
  if (data.scoreName) meta.push(`Model: ${data.scoreName}`);
  if (data.populationRank) meta.push(`Population rank: ${data.populationRank}`);
  if (meta.length) {
    ty = ctx.drawText(meta.join('  |  '), textX, ty - 4, 7.5, {
      color: MUTED,
      maxWidth: CONTENT_W - 130,
    });
  }
  ctx.y = drawScoreParagraph(ctx, textX, ty - 6) - 16;
}

function drawCreditInsights(ctx: PdfCanvas, data: CibilReportData) {
  const { creditSummary, scoreFactors } = data;
  const hasSummary =
    creditSummary.onTimePaymentHistory ||
    creditSummary.creditCardUtilization ||
    creditSummary.recentEnquiries ||
    creditSummary.creditMix ||
    creditSummary.oldestCreditAccountMonths;

  if (!hasSummary && !scoreFactors.length) return;

  ctx.tealHeader('CREDIT INSIGHTS');
  if (hasSummary) {
    ctx.stripedRows([
      {
        label: 'On-time payment history',
        value: creditSummary.onTimePaymentHistory ?? '-',
      },
      {
        label: 'Credit card utilization',
        value: creditSummary.creditCardUtilization ?? '-',
      },
      { label: 'Recent enquiries (12 mo.)', value: creditSummary.recentEnquiries ?? '-' },
      { label: 'Credit mix score', value: creditSummary.creditMix ?? '-' },
      {
        label: 'Oldest account (months)',
        value: creditSummary.oldestCreditAccountMonths ?? '-',
      },
    ]);
  }

  if (scoreFactors.length) {
    ctx.ensure(20);
    ctx.y = ctx.drawText('Factors affecting your score', MARGIN, ctx.y, 9, {
      bold: true,
      color: TEXT,
    });
    ctx.y -= 4;
    drawScoreFactorList(ctx, scoreFactors);
  }
}

function drawScoreFactorList(ctx: PdfCanvas, factors: CibilReportScoreFactor[]) {
  for (const factor of factors) {
    ctx.ensure(28);
    ctx.y = ctx.drawText(`${factor.code}.`, MARGIN, ctx.y, 8, { bold: true, color: CIBIL_TEAL });
    const textX = MARGIN + 18;
    ctx.y = ctx.drawText(factor.text, textX, ctx.y + 1, 7.5, {
      color: MUTED,
      maxWidth: CONTENT_W - 18,
    });
    ctx.y -= 4;
  }
  ctx.y -= 4;
}

function drawPreApprovedInsight(ctx: PdfCanvas, data: CibilReportData) {
  const insight = data.preApprovedInsight;
  const exposure = data.exposureInsight;

  ctx.tealHeader('PRE-APPROVED OFFER BASIS (INTERNAL)');
  ctx.stripedRows([
    {
      label: 'Max open unsecured exposure',
      value: formatExposureDisplay(exposure.maxOpenUnsecuredExposureInr),
    },
    {
      label: 'Driving tradeline',
      value:
        exposure.drivingCreditor && exposure.drivingAccountType
          ? `${exposure.drivingCreditor} (${exposure.drivingAccountType})`
          : '-',
    },
    {
      label: 'Matched tier',
      value: insight?.tierId != null ? `#${insight.tierId}` : '-',
    },
    {
      label: 'Unsecured exposure band',
      value: insight?.tierBandLabel ?? '-',
    },
    {
      label: 'Tier max bullet loan',
      value:
        insight?.maxBulletLoan != null ? formatExposureDisplay(insight.maxBulletLoan) : '-',
    },
    {
      label: 'Pre-approved offer (clamped)',
      value:
        insight?.preApprovedAmountInr != null
          ? formatExposureDisplay(insight.preApprovedAmountInr)
          : '-',
    },
    {
      label: 'Product loan bounds',
      value: insight
        ? `${formatExposureDisplay(insight.minLoanAmountInr)} – ${formatExposureDisplay(insight.maxLoanAmountInr)}`
        : '-',
    },
  ]);
  if (insight?.detail) {
    ctx.ensure(16);
    ctx.y = ctx.drawText(insight.detail, MARGIN, ctx.y, 7.5, { color: MUTED, maxWidth: CONTENT_W });
    ctx.y -= 8;
  }
}

function formatExposureDisplay(amountInr: number): string {
  return `Rs. ${Math.floor(amountInr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function drawAccountsSummary(ctx: PdfCanvas, data: CibilReportData) {
  const rows = data.accountOverview;
  if (!rows.length) return;

  const open = rows.filter((r) => r.status === 'Open').length;
  const closed = rows.length - open;

  ctx.tealHeader('ACCOUNTS SUMMARY');
  ctx.stripedRows([
    { label: 'Total accounts', value: String(rows.length) },
    { label: 'Open accounts', value: String(open) },
    { label: 'Closed accounts', value: String(closed) },
  ]);

  ctx.dataTable(
    ['Lender', 'Type', 'Status', 'Exposure', 'Unsecured'],
    rows.map((r) => [
      r.creditor,
      r.accountType,
      r.status,
      r.exposureLabel,
      r.isUnsecured ? 'Yes' : 'No',
    ]),
    [
      CONTENT_W * 0.26,
      CONTENT_W * 0.22,
      CONTENT_W * 0.1,
      CONTENT_W * 0.22,
      CONTENT_W * 0.2,
    ],
  );
}

function drawScoreParagraph(ctx: PdfCanvas, x: number, startY: number): number {
  const para =
    'Your CIBIL Score is a 3-digit numeric summary of your credit history. Lenders use it as a measure of your creditworthiness when you apply for a loan or credit card.';
  return ctx.drawText(para, x, startY, 8, { color: MUTED, maxWidth: CONTENT_W - (x - MARGIN) });
}

function drawSemiCircularGauge(ctx: PdfCanvas, cx: number, cy: number, radius: number, score: number) {
  const segments = 24;
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const a0 = Math.PI + t0 * Math.PI;
    const a1 = Math.PI + t1 * Math.PI;
    const color = t0 < 0.45 ? GAUGE_ORANGE : t0 < 0.72 ? GAUGE_YELLOW : GAUGE_GREEN;
    ctx.page.drawLine({
      start: { x: cx + Math.cos(a0) * radius, y: cy + Math.sin(a0) * radius },
      end: { x: cx + Math.cos(a1) * radius, y: cy + Math.sin(a1) * radius },
      thickness: 7,
      color,
    });
  }
  ctx.page.drawText('300', { x: cx - radius - 4, y: cy - 4, size: 7, font: ctx.fonts.regular, color: LABEL });
  ctx.page.drawText('900', {
    x: cx + radius - 10,
    y: cy - 4,
    size: 7,
    font: ctx.fonts.regular,
    color: LABEL,
  });
  const label = score > 0 ? String(score) : 'N/A';
  ctx.page.drawText(pdfSafeText(label), {
    x: cx - ctx.fonts.bold.widthOfTextAtSize(label, 22) / 2,
    y: cy - 18,
    size: 22,
    font: ctx.fonts.bold,
    color: TEXT,
  });
}

function drawPersonalDetails(ctx: PdfCanvas, data: CibilReportData) {
  ctx.tealHeader('PERSONAL DETAILS');
  ctx.dataTable(
    ['Name', 'Date Of Birth', 'Gender'],
    [[data.consumerName, data.dateOfBirthDisplay ?? '-', data.gender ?? '-']],
    [CONTENT_W * 0.45, CONTENT_W * 0.28, CONTENT_W * 0.27],
  );
}

function drawIdentificationDetails(ctx: PdfCanvas, data: CibilReportData) {
  ctx.tealHeader('IDENTIFICATION DETAILS');
  const idRows = data.identifiers.filter((id) => !id.type.toLowerCase().includes('social'));
  const rows = idRows.length
    ? idRows.map((id) => [id.type, id.number, '-', '-'])
    : data.pan
      ? [['Income Tax ID Number (PAN)', data.pan, '-', '-']]
      : [['-', '-', '-', '-']];
  ctx.dataTable(
    ['Identification Type', 'ID Number', 'Issue Date', 'Expiry Date'],
    rows,
    [CONTENT_W * 0.38, CONTENT_W * 0.32, CONTENT_W * 0.15, CONTENT_W * 0.15],
  );
}

function drawAddressDetails(ctx: PdfCanvas, data: CibilReportData) {
  ctx.tealHeader('ADDRESS DETAILS');
  if (!data.addresses.length) {
    ctx.stripedRows([{ label: 'Address', value: '-' }]);
    return;
  }
  const rows = data.addresses.map((a) => [
    a.address,
    a.category,
    '-',
    a.dateReported ?? '-',
  ]);
  ctx.dataTable(
    ['Address', 'Category', 'Residence Code', 'Date Reported'],
    rows,
    [CONTENT_W * 0.48, CONTENT_W * 0.22, CONTENT_W * 0.12, CONTENT_W * 0.18],
  );
}

function drawContactDetails(ctx: PdfCanvas, data: CibilReportData) {
  if (!data.phones.length) return;
  ctx.tealHeader('CONTACT DETAILS');
  ctx.dataTable(
    ['Telephone Number Type', 'Telephone Number', 'Telephone Extension'],
    data.phones.map((p) => [p.type, p.number, '-']),
    [CONTENT_W * 0.38, CONTENT_W * 0.42, CONTENT_W * 0.2],
  );
}

function drawEmailDetails(ctx: PdfCanvas, data: CibilReportData) {
  if (!data.emails.length) return;
  ctx.tealHeader('EMAIL DETAILS');
  ctx.dataTable(
    ['Email ID'],
    data.emails.map((e) => [e]),
    [CONTENT_W],
  );
}

function drawEmploymentDetails(ctx: PdfCanvas, data: CibilReportData) {
  if (!data.employmentOccupation && !data.employmentReportedDate) return;
  ctx.tealHeader('EMPLOYMENT DETAILS');
  ctx.dataTable(
    ['Account Type', 'Date Reported', 'Occupation', 'Income'],
    [
      [
        data.employmentAccountType ?? '-',
        data.employmentReportedDate ?? '-',
        data.employmentOccupation ?? '-',
        '-',
      ],
    ],
    [CONTENT_W * 0.22, CONTENT_W * 0.22, CONTENT_W * 0.28, CONTENT_W * 0.28],
  );
}

function drawAllAccounts(ctx: PdfCanvas, data: CibilReportData) {
  const open = data.accounts.filter((a) => a.status === 'Open');
  const closed = data.accounts.filter((a) => a.status !== 'Open');

  ctx.tealHeader('ALL ACCOUNTS');

  if (open.length) {
    ctx.ensure(20);
    ctx.y = ctx.drawText('OPEN ACCOUNTS', MARGIN, ctx.y, 10, { bold: true, color: OPEN_GREEN });
    ctx.y -= 8;
    for (const account of open) {
      drawSingleAccount(ctx, account);
    }
  }

  if (closed.length) {
    ctx.ensure(20);
    ctx.y = ctx.drawText('CLOSED ACCOUNTS', MARGIN, ctx.y, 10, { bold: true, color: MUTED });
    ctx.y -= 8;
    for (const account of closed) {
      drawSingleAccount(ctx, account);
    }
  }
}

function drawSingleAccount(ctx: PdfCanvas, account: CibilReportAccountRow) {
  if (ctx.y < 200) ctx.newPage();

  ctx.ensure(24);
  ctx.stripedRows([
    { label: 'Member Name', value: account.creditor },
    { label: 'Account Type', value: account.accountType },
    { label: 'Account Number', value: account.accountNumber },
    { label: 'Ownership', value: account.ownership },
  ]);

  ctx.y = ctx.drawText('ACCOUNT DETAILS', MARGIN, ctx.y, 9, { bold: true, color: CIBIL_TEAL });
  ctx.y -= 4;
  ctx.stripedRows([
    { label: 'Credit Limit', value: account.sanctionedAmount },
    { label: 'High Credit', value: account.highBalance },
    { label: 'Current Balance', value: account.currentBalance },
    { label: 'Cash Limit', value: account.cashLimit },
    { label: 'Amount Overdue', value: account.overdueAmount },
    { label: 'Rate of Interest', value: account.rateOfInterest },
    { label: 'Repayment Tenure', value: account.repaymentTenure },
    { label: 'EMI Amount', value: account.emiAmount },
    { label: 'Payment Frequency', value: account.paymentFrequency },
  ]);

  ctx.stripedRows([
    { label: 'Date Opened / Disbursed', value: account.dateOpened ?? '-' },
    { label: 'Date Closed', value: account.dateClosed ?? '-' },
    { label: 'Date of Last Payment', value: account.dateLastPayment ?? '-' },
    { label: 'Date Reported And Certified', value: account.dateReported ?? '-' },
    { label: 'Value of Collateral', value: '-' },
    { label: 'Type of Collateral', value: '-' },
    { label: 'Suit - Filed / Wilful Default', value: account.suitFiled },
    { label: 'Written-off Amount (Total)', value: account.writtenOffTotal },
    { label: 'Written-off Amount (Principal)', value: account.writtenOffPrincipal },
    { label: 'Settlement Amount', value: account.settlementAmount },
  ]);

  drawPaymentStatusSection(ctx, account);
  ctx.y -= 6;
}

function drawPaymentStatusSection(ctx: PdfCanvas, account: CibilReportAccountRow) {
  ctx.y = ctx.drawText('PAYMENT STATUS', MARGIN, ctx.y, 9, { bold: true, color: CIBIL_TEAL });
  ctx.y -= 4;
  ctx.stripedRows([
    { label: 'Payment Start Date', value: account.paymentStartDate ?? '-' },
    { label: 'Payment End Date', value: account.paymentEndDate ?? '-' },
  ]);

  drawPaymentCalendar(ctx, account.paymentHistory);
  drawPaymentStatusLegend(ctx);
}

function formatPaymentStatusCell(status: string | undefined): string {
  if (!status) return '';
  const s = status.trim();
  if (!s) return '';
  if (s.toUpperCase() === 'XXX') return 'XXX';
  if (/^\d+$/.test(s)) return s;
  return s.length > 3 ? s.slice(0, 3) : s;
}

function drawPaymentCalendar(ctx: PdfCanvas, history: CibilReportPaymentMonth[]) {
  const byYear = new Map<number, Map<number, string>>();
  for (const h of history) {
    if (!byYear.has(h.year)) byYear.set(h.year, new Map());
    byYear.get(h.year)!.set(h.month, h.status);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a).slice(0, 4);
  if (!years.length) return;

  const yearColW = 36;
  const colW = (CONTENT_W - yearColW) / MONTH_COLS.length;
  const headers = ['Year', ...MONTH_COLS];
  const widths = [yearColW, ...MONTH_COLS.map(() => colW)];

  ctx.ensure(16 + years.length * 14);
  let x = MARGIN;
  headers.forEach((h, i) => {
    ctx.page.drawText(pdfSafeText(h), {
      x: x + 2,
      y: ctx.y,
      size: 6.5,
      font: ctx.fonts.bold,
      color: LABEL,
    });
    x += widths[i];
  });
  ctx.y -= 11;
  ctx.line(MARGIN, ctx.y, PAGE_W - MARGIN, ctx.y);
  ctx.y -= 5;

  for (const year of years) {
    ctx.ensure(14);
    const months = byYear.get(year)!;
    let cx = MARGIN;
    const baseY = ctx.y - 11;
    const cells = [
      String(year),
      ...MONTH_COLS.map((_, idx) => {
        const monthNum = 12 - idx;
        return formatPaymentStatusCell(months.get(monthNum));
      }),
    ];
    cells.forEach((cell, i) => {
      ctx.page.drawText(pdfSafeText(cell), {
        x: cx + 2,
        y: baseY,
        size: 6.5,
        font: ctx.fonts.regular,
        color: TEXT,
      });
      cx += widths[i];
    });
    ctx.line(MARGIN, baseY - 2, PAGE_W - MARGIN, baseY - 2);
    ctx.y = baseY - 5;
  }
  ctx.y -= 6;
}

function drawPaymentStatusLegend(ctx: PdfCanvas) {
  ctx.ensure(36);
  const colW = CONTENT_W / 3;
  const rows: Array<[string, string, string]> = [
    ['STD: Standard', 'DBT: Doubtful', '###: Number of days past due'],
    ['SMA: Special Mention account', 'LSS: Loss', 'XXX: Not Reported'],
    ['SUB: Substandard', '', ''],
  ];
  for (const [a, b, c] of rows) {
    ctx.page.drawText(pdfSafeText(a), { x: MARGIN, y: ctx.y, size: 6, font: ctx.fonts.regular, color: MUTED });
    ctx.page.drawText(pdfSafeText(b), {
      x: MARGIN + colW,
      y: ctx.y,
      size: 6,
      font: ctx.fonts.regular,
      color: MUTED,
    });
    ctx.page.drawText(pdfSafeText(c), {
      x: MARGIN + colW * 2,
      y: ctx.y,
      size: 6,
      font: ctx.fonts.regular,
      color: MUTED,
    });
    ctx.y -= 9;
  }
  ctx.y -= 4;
}

function drawEnquiryDetails(ctx: PdfCanvas, inquiries: CibilReportInquiryRow[]) {
  if (ctx.y < 120) ctx.newPage();
  ctx.tealHeader('ENQUIRY DETAILS');
  ctx.y = ctx.drawText(
    '(*) Indicates the value provided by bank when you applied for a credit facility.',
    MARGIN,
    ctx.y,
    6.5,
    { color: MUTED, maxWidth: CONTENT_W },
  );
  ctx.y -= 4;

  if (!inquiries.length) {
    ctx.stripedRows([{ label: 'Enquiries', value: 'None' }]);
    return;
  }

  ctx.dataTable(
    ['Member Name', 'Date Of Enquiry', 'Enquiry Purpose', 'Amount'],
    inquiries.slice(0, 40).map((i) => [i.member, i.date, i.purpose, i.amount]),
    [CONTENT_W * 0.3, CONTENT_W * 0.2, CONTENT_W * 0.28, CONTENT_W * 0.22],
  );
}

function drawReportFooter(ctx: PdfCanvas, data: CibilReportData) {
  ctx.ensure(80);
  ctx.y -= 8;
  const midX = PAGE_W / 2;
  ctx.line(MARGIN + 80, ctx.y, PAGE_W - MARGIN - 80, ctx.y);
  ctx.page.drawText('End of report', {
    x: midX - ctx.fonts.bold.widthOfTextAtSize('End of report', 9) / 2,
    y: ctx.y + 4,
    size: 9,
    font: ctx.fonts.bold,
    color: TEXT,
  });
  ctx.y -= 16;

  const disclaimer =
    'Disclaimer: All information contained in this credit report has been collated by TransUnion CIBIL Limited (TU CIBIL) based on information provided/submitted by its Members. This internal reproduction from TrueLink bureau data is for operational use; refer to the official bureau portal for the authoritative report.';
  ctx.y = ctx.drawText(disclaimer, MARGIN, ctx.y, 6.5, { color: MUTED, maxWidth: CONTENT_W });
  ctx.y -= 8;
  ctx.y = ctx.drawText(
    'COPYRIGHT 2026 TRANSUNION CIBIL. ALL RIGHTS RESERVED. For more information, visit www.cibil.com',
    MARGIN,
    ctx.y,
    6.5,
    { color: MUTED, maxWidth: CONTENT_W },
  );
  if (data.vendorHtmlUrl) {
    ctx.drawText(`Bureau portal: ${data.vendorHtmlUrl}`, MARGIN, ctx.y - 4, 6.5, {
      color: CIBIL_TEAL,
      maxWidth: CONTENT_W,
    });
  }
}

function wrap(text: string, maxWidth: number, fontSize: number, font: PDFFont): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}
