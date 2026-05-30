import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage, type PDFFont } from 'pdf-lib';
import { pdfSafeText } from '../pdf/pdf-safe-text.util';
import { parsePayStatusToDpdDays } from './cibil-bureau-rules.parser';
import { formatControlNumberDisplay } from './cibil-report-data.extractor';
import {
  isAdverseAmountDisplay,
  PAYMENT_STATUS_LEGEND,
  resolvePaymentStatusVisual,
} from './cibil-payment-status-style.util';
import type {
  CibilReportAccountRow,
  CibilReportData,
  CibilReportInquiryRow,
  CibilReportPaymentMonth,
  CibilReportScoreFactor,
} from './cibil-report-data.extractor';

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 32;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Typography scale — tuned for readable print/PDF viewing. */
const TYPE = {
  hero: 26,
  title: 16,
  section: 12,
  subheading: 11,
  body: 10,
  bodySm: 9,
  caption: 8,
  tableHead: 9,
  tableCell: 9.5,
  gaugeScore: 30,
  gaugeScale: 8.5,
} as const;

const SPACE = {
  sectionAfterBanner: 10,
  rowHeight: 20,
  bannerHeight: 24,
  accountBarHeight: 24,
  paymentCellHeight: 17,
  footerReserve: 36,
  runningHeaderHeight: 30,
} as const;

const CIBIL_TEAL = rgb(0.2, 0.58, 0.62);
const CIBIL_NAVY = rgb(0.12, 0.32, 0.48);
const ACCOUNT_HEADER_GOLD = rgb(0.99, 0.84, 0.0);
const HEADER_BAND = rgb(0.1, 0.28, 0.42);
const SCORE_PANEL_BG = rgb(0.94, 0.98, 0.99);
const ROW_ALT_BG = rgb(0.97, 0.98, 0.99);
const RISK_PANEL_BG = rgb(0.98, 0.96, 0.92);
const RISK_OK = rgb(0.1, 0.48, 0.24);
const RISK_WARN = rgb(0.78, 0.45, 0.05);
const OPEN_GREEN = rgb(0.08, 0.52, 0.28);
const ADVERSE_AMOUNT = rgb(0.72, 0.12, 0.14);
const BORDER = rgb(0.82, 0.85, 0.88);
const LABEL = rgb(0.38, 0.42, 0.48);
const TEXT = rgb(0.12, 0.14, 0.18);
const MUTED = rgb(0.42, 0.45, 0.5);
const GAUGE_ORANGE = rgb(0.95, 0.52, 0.15);
const GAUGE_YELLOW = rgb(0.98, 0.78, 0.15);
const GAUGE_GREEN = rgb(0.15, 0.68, 0.32);

const MONTH_COLS = ['Dec', 'Nov', 'Oct', 'Sep', 'Aug', 'Jul', 'Jun', 'May', 'Apr', 'Mar', 'Feb', 'Jan'] as const;

const MONEYCASH_LOGO_PATH = path.join(
  process.cwd(),
  'assets',
  'loan-documents',
  'moneycash-logo.png',
);

const HEADER_LOGO_HEIGHT = 48;

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

  const ctx = new PdfCanvas(pdf, fonts, logo, data);
  drawPrintHeader(ctx, data);
  drawScoreSection(ctx, data);
  drawRiskSummaryStrip(ctx, data);
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
  stampPageFooters(pdf, fonts, data);

  return pdf.save();
}

class PdfCanvas {
  page: PDFPage;
  y = PAGE_H - MARGIN;
  pageIndex = 0;

  constructor(
    readonly pdf: PDFDocument,
    readonly fonts: Fonts,
    readonly logo: PDFImage | null = null,
    readonly reportData: CibilReportData,
  ) {
    this.page = pdf.addPage([PAGE_W, PAGE_H]);
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.pageIndex += 1;
    drawRunningPageHeader(this);
    this.y = PAGE_H - MARGIN - SPACE.runningHeaderHeight;
  }

  ensure(needed: number) {
    if (this.y - needed >= MARGIN + SPACE.footerReserve) return;
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
      cy -= size + 4;
    }
    return cy;
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.6, color: BORDER });
  }

  tealHeader(title: string) {
    this.sectionBanner(title, CIBIL_NAVY, rgb(1, 1, 1));
  }

  /** Label (left) | value (right) rows like CIBIL print view. */
  stripedRows(rows: Array<{ label: string; value: string; valueColor?: ReturnType<typeof rgb> }>) {
    rows.forEach((row, index) => {
      this.ensure(SPACE.rowHeight + 4);
      const rowH = SPACE.rowHeight;
      const baseY = this.y - rowH;

      if (index % 2 === 0) {
        this.page.drawRectangle({
          x: MARGIN,
          y: baseY,
          width: CONTENT_W,
          height: rowH,
          color: ROW_ALT_BG,
        });
      }

      this.line(MARGIN, baseY, PAGE_W - MARGIN, baseY);
      this.page.drawText(pdfSafeText(row.label), {
        x: MARGIN + 6,
        y: baseY + 5,
        size: TYPE.bodySm,
        font: this.fonts.bold,
        color: LABEL,
      });
      const val = wrap(pdfSafeText(row.value), CONTENT_W * 0.55, TYPE.body, this.fonts.regular)[0] ?? '-';
      const valueColor = row.valueColor ?? TEXT;
      const valueFont = row.valueColor ? this.fonts.bold : this.fonts.regular;
      this.page.drawText(val, {
        x: PAGE_W - MARGIN - 6 - valueFont.widthOfTextAtSize(val, TYPE.body),
        y: baseY + 5,
        size: TYPE.body,
        font: valueFont,
        color: valueColor,
      });
      this.y = baseY - 2;
    });
    this.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y -= SPACE.sectionAfterBanner;
  }

  sectionBanner(title: string, fill: ReturnType<typeof rgb>, textColor: ReturnType<typeof rgb>) {
    this.ensure(SPACE.bannerHeight + 12);
    const barH = SPACE.bannerHeight;
    const baseY = this.y - barH;
    this.page.drawRectangle({
      x: MARGIN,
      y: baseY,
      width: CONTENT_W,
      height: barH,
      color: fill,
    });
    this.page.drawRectangle({
      x: MARGIN,
      y: baseY,
      width: 4,
      height: barH,
      color: CIBIL_TEAL,
    });
    this.page.drawText(pdfSafeText(title), {
      x: MARGIN + 12,
      y: baseY + 6,
      size: TYPE.section,
      font: this.fonts.bold,
      color: textColor,
    });
    this.y = baseY - SPACE.sectionAfterBanner;
  }

  dataTable(headers: string[], rows: string[][], colWidths: number[]) {
    const tableW = colWidths.reduce((a, b) => a + b, 0);
    const rowH = SPACE.rowHeight;
    let x0 = MARGIN;

    this.ensure(rowH + 8 + rows.length * (rowH + 2));
    const headY = this.y - rowH;
    this.page.drawRectangle({
      x: MARGIN,
      y: headY,
      width: tableW,
      height: rowH,
      color: rgb(0.9, 0.93, 0.96),
    });

    headers.forEach((h, i) => {
      this.page.drawText(pdfSafeText(h.toUpperCase()), {
        x: x0 + 6,
        y: headY + 5,
        size: TYPE.tableHead,
        font: this.fonts.bold,
        color: CIBIL_NAVY,
      });
      x0 += colWidths[i];
    });
    this.y = headY - 4;
    this.line(MARGIN, this.y, MARGIN + tableW, this.y);
    this.y -= 4;

    for (const row of rows) {
      this.ensure(rowH + 4);
      let cx = MARGIN;
      const baseY = this.y - rowH;
      row.forEach((cell, i) => {
        const line = wrap(pdfSafeText(cell), colWidths[i] - 10, TYPE.tableCell, this.fonts.regular)[0] ?? '-';
        this.page.drawText(line, {
          x: cx + 6,
          y: baseY + 5,
          size: TYPE.tableCell,
          font: this.fonts.regular,
          color: TEXT,
        });
        cx += colWidths[i];
      });
      this.line(MARGIN, baseY - 1, MARGIN + tableW, baseY - 1);
      this.y = baseY - 3;
    }
    this.y -= 6;
  }
}

function drawPrintHeader(ctx: PdfCanvas, data: CibilReportData) {
  const bandH = 72;
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_H - bandH,
    width: PAGE_W,
    height: bandH,
    color: HEADER_BAND,
  });
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_H - bandH,
    width: PAGE_W,
    height: 4,
    color: CIBIL_TEAL,
  });

  const headerTop = PAGE_H - 20;
  let textX = MARGIN;
  let blockBottom = headerTop - 40;

  if (ctx.logo) {
    const scale = HEADER_LOGO_HEIGHT / ctx.logo.height;
    const logoW = ctx.logo.width * scale;
    const logoY = headerTop - HEADER_LOGO_HEIGHT + 4;
    ctx.page.drawRectangle({
      x: MARGIN - 4,
      y: logoY - 4,
      width: logoW + 8,
      height: HEADER_LOGO_HEIGHT + 8,
      color: rgb(1, 1, 1),
    });
    ctx.page.drawImage(ctx.logo, {
      x: MARGIN,
      y: logoY,
      width: logoW,
      height: HEADER_LOGO_HEIGHT,
    });
    textX = MARGIN + logoW + 14;
    blockBottom = Math.min(blockBottom, logoY - 8);
  }

  const titleY = headerTop - 2;
  ctx.drawText('CIBIL', textX, titleY, TYPE.hero, { bold: true, color: rgb(1, 1, 1) });
  ctx.drawText('Score & Credit Report', textX, titleY - 26, TYPE.title, { bold: true, color: rgb(0.85, 0.92, 0.96) });
  blockBottom = Math.min(blockBottom, titleY - 44);

  const control = formatControlNumberDisplay(data.controlNumber) ?? '-';
  const dateStr = data.reportDateDisplay ?? data.bureauInquiryDate ?? '-';
  ctx.drawText(`Control Number: ${control}`, PAGE_W - MARGIN - 170, PAGE_H - 28, TYPE.bodySm, {
    color: rgb(0.82, 0.88, 0.92),
    maxWidth: 170,
  });
  ctx.drawText(`Report Date: ${dateStr}`, PAGE_W - MARGIN - 170, PAGE_H - 42, TYPE.bodySm, {
    color: rgb(0.82, 0.88, 0.92),
    maxWidth: 170,
  });

  ctx.y = blockBottom - 20;
}

function drawRunningPageHeader(ctx: PdfCanvas) {
  const barH = SPACE.runningHeaderHeight - 6;
  const baseY = PAGE_H - MARGIN - barH + 2;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: baseY,
    width: CONTENT_W,
    height: barH,
    color: rgb(0.94, 0.96, 0.98),
    borderColor: BORDER,
    borderWidth: 0.5,
  });
  ctx.page.drawRectangle({
    x: MARGIN,
    y: baseY,
    width: 3,
    height: barH,
    color: CIBIL_TEAL,
  });

  const name = pdfSafeText(ctx.reportData.consumerName);
  const score = ctx.reportData.cibilScore ?? 'N/A';
  ctx.page.drawText(name, {
    x: MARGIN + 10,
    y: baseY + 8,
    size: TYPE.bodySm,
    font: ctx.fonts.bold,
    color: CIBIL_NAVY,
  });
  ctx.page.drawText(`CIBIL Score: ${score}`, {
    x: PAGE_W - MARGIN - 90,
    y: baseY + 8,
    size: TYPE.bodySm,
    font: ctx.fonts.bold,
    color: CIBIL_TEAL,
  });
}

type ReportRiskHighlights = {
  openAccounts: number;
  closedAccounts: number;
  maxDpd: number;
  adverseAccounts: number;
  openOverdueAccounts: number;
  enquiryCount: number;
};

function computeReportRiskHighlights(data: CibilReportData): ReportRiskHighlights {
  let maxDpd = 0;
  let adverseAccounts = 0;
  let openOverdueAccounts = 0;

  for (const account of data.accounts) {
    const hasAdverseSignal =
      isAdverseAmountDisplay(account.writtenOffTotal) ||
      isAdverseAmountDisplay(account.writtenOffPrincipal) ||
      isAdverseAmountDisplay(account.settlementAmount) ||
      (account.suitFiled.trim() !== '-' && account.suitFiled.trim() !== '');

    if (hasAdverseSignal) adverseAccounts += 1;
    if (account.status === 'Open' && isAdverseAmountDisplay(account.overdueAmount)) {
      openOverdueAccounts += 1;
    }

    for (const month of account.paymentHistory) {
      const dpd = parsePayStatusToDpdDays(month.status);
      if (dpd != null) maxDpd = Math.max(maxDpd, dpd);
    }
  }

  const openAccounts = data.accounts.filter((a) => a.status === 'Open').length;
  return {
    openAccounts,
    closedAccounts: data.accounts.length - openAccounts,
    maxDpd,
    adverseAccounts,
    openOverdueAccounts,
    enquiryCount: data.inquiries.length,
  };
}

function drawRiskSummaryStrip(ctx: PdfCanvas, data: CibilReportData) {
  const risk = computeReportRiskHighlights(data);
  const panelH = 68;
  ctx.ensure(panelH + 8);
  const panelTop = ctx.y;
  const panelBase = panelTop - panelH;

  ctx.page.drawRectangle({
    x: MARGIN,
    y: panelBase,
    width: CONTENT_W,
    height: panelH,
    color: RISK_PANEL_BG,
    borderColor: rgb(0.88, 0.82, 0.68),
    borderWidth: 0.75,
  });

  ctx.page.drawText('CREDIT RISK SNAPSHOT', {
    x: MARGIN + 10,
    y: panelTop - 14,
    size: TYPE.bodySm,
    font: ctx.fonts.bold,
    color: CIBIL_NAVY,
  });

  const row1: Array<{ label: string; value: string; tone: ReturnType<typeof rgb> }> = [
    {
      label: 'CIBIL Score',
      value: data.cibilScore != null ? String(data.cibilScore) : 'N/A',
      tone: scoreTone(data.cibilScore),
    },
    { label: 'Open accounts', value: String(risk.openAccounts), tone: TEXT },
    { label: 'Closed accounts', value: String(risk.closedAccounts), tone: MUTED },
    {
      label: 'Max DPD (history)',
      value: risk.maxDpd > 0 ? String(risk.maxDpd) : '0',
      tone: risk.maxDpd >= 90 ? ADVERSE_AMOUNT : risk.maxDpd >= 30 ? RISK_WARN : RISK_OK,
    },
  ];
  const row2: Array<{ label: string; value: string; tone: ReturnType<typeof rgb> }> = [
    {
      label: 'Adverse tradelines',
      value: String(risk.adverseAccounts),
      tone: risk.adverseAccounts > 0 ? ADVERSE_AMOUNT : RISK_OK,
    },
    {
      label: 'Open with overdue',
      value: String(risk.openOverdueAccounts),
      tone: risk.openOverdueAccounts > 0 ? ADVERSE_AMOUNT : RISK_OK,
    },
    { label: 'Total enquiries', value: String(risk.enquiryCount), tone: TEXT },
    {
      label: 'Rating',
      value: data.scoreRatingLabel ?? '-',
      tone: scoreTone(data.cibilScore),
    },
  ];

  drawRiskMetricRow(ctx, row1, panelBase + 34, panelTop - 20);
  ctx.page.drawLine({
    start: { x: MARGIN + 8, y: panelBase + 30 },
    end: { x: PAGE_W - MARGIN - 8, y: panelBase + 30 },
    thickness: 0.4,
    color: BORDER,
  });
  drawRiskMetricRow(ctx, row2, panelBase + 8, panelBase + 30);

  ctx.y = panelBase - 12;
}

function drawRiskMetricRow(
  ctx: PdfCanvas,
  metrics: Array<{ label: string; value: string; tone: ReturnType<typeof rgb> }>,
  valueY: number,
  dividerTop: number,
) {
  const colW = CONTENT_W / metrics.length;
  metrics.forEach((metric, index) => {
    const x = MARGIN + index * colW + 8;
    ctx.page.drawText(pdfSafeText(metric.label), {
      x,
      y: valueY - 14,
      size: TYPE.caption,
      font: ctx.fonts.regular,
      color: LABEL,
    });
    ctx.page.drawText(pdfSafeText(metric.value), {
      x,
      y: valueY,
      size: TYPE.subheading,
      font: ctx.fonts.bold,
      color: metric.tone,
    });
    if (index > 0) {
      ctx.page.drawLine({
        start: { x: MARGIN + index * colW, y: dividerTop },
        end: { x: MARGIN + index * colW, y: dividerTop + 22 },
        thickness: 0.5,
        color: BORDER,
      });
    }
  });
}

function scoreTone(score: number | null): ReturnType<typeof rgb> {
  if (score == null || score <= 0) return MUTED;
  if (score >= 750) return RISK_OK;
  if (score >= 650) return RISK_WARN;
  return ADVERSE_AMOUNT;
}

function stampPageFooters(pdf: PDFDocument, fonts: Fonts, data: CibilReportData) {
  const pages = pdf.getPages();
  const total = pages.length;
  const dateStr = data.reportDateDisplay ?? data.bureauInquiryDate ?? '-';

  pages.forEach((page, index) => {
    const pageNum = index + 1;
    const footerY = 22;
    page.drawLine({
      start: { x: MARGIN, y: footerY + 10 },
      end: { x: PAGE_W - MARGIN, y: footerY + 10 },
      thickness: 0.5,
      color: BORDER,
    });
    page.drawText(pdfSafeText(data.consumerName), {
      x: MARGIN,
      y: footerY,
      size: TYPE.caption,
      font: fonts.regular,
      color: MUTED,
    });
    page.drawText(`Report date: ${pdfSafeText(dateStr)}`, {
      x: MARGIN + 140,
      y: footerY,
      size: TYPE.caption,
      font: fonts.regular,
      color: MUTED,
    });
    const pageLabel = `Page ${pageNum} of ${total}`;
    page.drawText(pageLabel, {
      x: PAGE_W - MARGIN - fonts.regular.widthOfTextAtSize(pageLabel, TYPE.caption),
      y: footerY,
      size: TYPE.caption,
      font: fonts.regular,
      color: CIBIL_NAVY,
    });
  });
}

function drawScoreSection(ctx: PdfCanvas, data: CibilReportData) {
  const score = data.cibilScore ?? 0;
  const panelH = 118;
  ctx.ensure(panelH + 12);
  const panelTop = ctx.y;
  const panelBase = panelTop - panelH;

  ctx.page.drawRectangle({
    x: MARGIN,
    y: panelBase,
    width: CONTENT_W,
    height: panelH,
    color: SCORE_PANEL_BG,
    borderColor: BORDER,
    borderWidth: 0.75,
  });
  ctx.page.drawRectangle({
    x: MARGIN,
    y: panelBase,
    width: 4,
    height: panelH,
    color: CIBIL_TEAL,
  });

  const gaugeY = panelTop - 18;
  drawSemiCircularGauge(ctx, MARGIN + 24, gaugeY, 52, score);

  const textX = MARGIN + 148;
  let ty = gaugeY - 4;
  ty = ctx.drawText(`Hello, ${data.consumerName}`, textX, ty, TYPE.title, { bold: true });
  const asOf = data.reportDateDisplay ?? '-';
  ty = ctx.drawText(
    `Your CIBIL Score is ${data.cibilScore ?? 'N/A'} as of ${asOf}`,
    textX,
    ty - 6,
    TYPE.subheading,
    { bold: true, maxWidth: CONTENT_W - 148 },
  );
  if (data.scoreRatingLabel) {
    ty = ctx.drawText(`Rating: ${data.scoreRatingLabel}`, textX, ty - 6, TYPE.body, {
      bold: true,
      color: OPEN_GREEN,
      maxWidth: CONTENT_W - 148,
    });
  }
  const meta: string[] = [];
  if (data.scoreName) meta.push(`Model: ${data.scoreName}`);
  if (data.populationRank) meta.push(`Population rank: ${data.populationRank}`);
  if (meta.length) {
    ty = ctx.drawText(meta.join('  |  '), textX, ty - 6, TYPE.bodySm, {
      color: MUTED,
      maxWidth: CONTENT_W - 148,
    });
  }
  drawScoreParagraph(ctx, textX, ty - 8);
  ctx.y = panelBase - 14;
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
    ctx.y = ctx.drawText('Factors affecting your score', MARGIN, ctx.y, TYPE.subheading, {
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
    ctx.y = ctx.drawText(`${factor.code}.`, MARGIN, ctx.y, TYPE.bodySm, { bold: true, color: CIBIL_TEAL });
    const textX = MARGIN + 20;
    ctx.y = ctx.drawText(factor.text, textX, ctx.y + 1, TYPE.bodySm, {
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
    ctx.y = ctx.drawText(insight.detail, MARGIN, ctx.y, TYPE.bodySm, { color: MUTED, maxWidth: CONTENT_W });
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
  return ctx.drawText(para, x, startY, TYPE.bodySm, { color: MUTED, maxWidth: CONTENT_W - (x - MARGIN) });
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
      thickness: 8,
      color,
    });
  }
  ctx.page.drawText('300', { x: cx - radius - 6, y: cy - 4, size: TYPE.gaugeScale, font: ctx.fonts.regular, color: LABEL });
  ctx.page.drawText('900', {
    x: cx + radius - 12,
    y: cy - 4,
    size: TYPE.gaugeScale,
    font: ctx.fonts.regular,
    color: LABEL,
  });
  const label = score > 0 ? String(score) : 'N/A';
  ctx.page.drawText(pdfSafeText(label), {
    x: cx - ctx.fonts.bold.widthOfTextAtSize(label, TYPE.gaugeScore) / 2,
    y: cy - 20,
    size: TYPE.gaugeScore,
    font: ctx.fonts.bold,
    color: CIBIL_NAVY,
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
    ctx.ensure(24);
    ctx.y = ctx.drawText('OPEN ACCOUNTS', MARGIN, ctx.y, TYPE.subheading, { bold: true, color: OPEN_GREEN });
    ctx.y -= 10;
    for (const account of open) {
      drawSingleAccount(ctx, account);
    }
  }

  if (closed.length) {
    ctx.ensure(24);
    ctx.y = ctx.drawText('CLOSED ACCOUNTS', MARGIN, ctx.y, TYPE.subheading, { bold: true, color: MUTED });
    ctx.y -= 10;
    for (const account of closed) {
      drawSingleAccount(ctx, account);
    }
  }
}

function drawSingleAccount(ctx: PdfCanvas, account: CibilReportAccountRow) {
  if (ctx.y < 240) ctx.newPage();

  const cardTop = ctx.y;
  drawAccountHeaderBar(ctx, account);

  ctx.y = ctx.drawText('ACCOUNT DETAILS', MARGIN, ctx.y, TYPE.subheading, { bold: true, color: CIBIL_TEAL });
  ctx.y -= 6;
  ctx.stripedRows([
    { label: 'Credit Limit', value: account.sanctionedAmount },
    { label: 'High Credit', value: account.highBalance },
    { label: 'Current Balance', value: account.currentBalance },
    { label: 'Cash Limit', value: account.cashLimit },
    {
      label: 'Amount Overdue',
      value: account.overdueAmount,
      valueColor: isAdverseAmountDisplay(account.overdueAmount) ? ADVERSE_AMOUNT : undefined,
    },
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
    { label: 'Value of Collateral', value: account.collateralValue },
    { label: 'Type of Collateral', value: account.collateralType },
    {
      label: 'Suit - Filed / Wilful Default',
      value: account.suitFiled,
      valueColor:
        account.suitFiled.trim() !== '-' && account.suitFiled.trim() !== ''
          ? ADVERSE_AMOUNT
          : undefined,
    },
    {
      label: 'Written-off Amount (Total)',
      value: account.writtenOffTotal,
      valueColor: isAdverseAmountDisplay(account.writtenOffTotal) ? ADVERSE_AMOUNT : undefined,
    },
    {
      label: 'Written-off Amount (Principal)',
      value: account.writtenOffPrincipal,
      valueColor: isAdverseAmountDisplay(account.writtenOffPrincipal) ? ADVERSE_AMOUNT : undefined,
    },
    {
      label: 'Settlement Amount',
      value: account.settlementAmount,
      valueColor: isAdverseAmountDisplay(account.settlementAmount) ? ADVERSE_AMOUNT : undefined,
    },
  ]);

  drawPaymentStatusSection(ctx, account);
  ctx.y -= 8;

  const cardBottom = ctx.y;
  ctx.page.drawRectangle({
    x: MARGIN - 3,
    y: cardBottom - 2,
    width: CONTENT_W + 6,
    height: cardTop - cardBottom + 6,
    borderColor: BORDER,
    borderWidth: 0.75,
  });
  ctx.y -= 6;
}

function drawAccountHeaderBar(ctx: PdfCanvas, account: CibilReportAccountRow) {
  ctx.ensure(SPACE.accountBarHeight + 10);
  const barH = SPACE.accountBarHeight;
  const baseY = ctx.y - barH;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: baseY,
    width: CONTENT_W,
    height: barH,
    color: ACCOUNT_HEADER_GOLD,
    borderColor: rgb(0.75, 0.62, 0),
    borderWidth: 0.5,
  });

  const cols = [account.creditor, account.accountType, account.accountNumber, account.ownership];
  const colW = CONTENT_W / cols.length;
  cols.forEach((text, index) => {
    const cell = wrap(pdfSafeText(text), colW - 10, TYPE.body, ctx.fonts.bold)[0] ?? '-';
    ctx.page.drawText(cell, {
      x: MARGIN + index * colW + 6,
      y: baseY + 6,
      size: TYPE.body,
      font: ctx.fonts.bold,
      color: rgb(0, 0, 0),
    });
  });
  ctx.y = baseY - 10;
}

function drawPaymentStatusSection(ctx: PdfCanvas, account: CibilReportAccountRow) {
  ctx.y = ctx.drawText('PAYMENT STATUS', MARGIN, ctx.y, TYPE.subheading, { bold: true, color: CIBIL_TEAL });
  ctx.y -= 6;
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

  const yearColW = 40;
  const colW = (CONTENT_W - yearColW) / MONTH_COLS.length;
  const cellH = SPACE.paymentCellHeight;
  const headers = ['Year', ...MONTH_COLS];
  const widths = [yearColW, ...MONTH_COLS.map(() => colW)];

  ctx.ensure(18 + years.length * (cellH + 5));
  const headBase = ctx.y - cellH;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: headBase,
    width: CONTENT_W,
    height: cellH,
    color: rgb(0.9, 0.93, 0.96),
  });
  let x = MARGIN;
  headers.forEach((h, i) => {
    ctx.page.drawText(pdfSafeText(h), {
      x: x + 3,
      y: headBase + 4,
      size: TYPE.caption,
      font: ctx.fonts.bold,
      color: CIBIL_NAVY,
    });
    x += widths[i];
  });
  ctx.y = headBase - 4;
  ctx.line(MARGIN, ctx.y, PAGE_W - MARGIN, ctx.y);
  ctx.y -= 5;

  for (const year of years) {
    ctx.ensure(cellH + 8);
    const months = byYear.get(year)!;
    const rowTop = ctx.y;
    const baseY = rowTop - cellH;
    let cx = MARGIN;

    drawPaymentStatusCell(ctx, cx, rowTop, widths[0], cellH, String(year), false);
    cx += widths[0];

    MONTH_COLS.forEach((_, idx) => {
      const monthNum = 12 - idx;
      const rawStatus = months.get(monthNum) ?? '';
      drawPaymentStatusCell(ctx, cx, rowTop, colW, cellH, rawStatus, true);
      cx += colW;
    });

    ctx.line(MARGIN, baseY - 1, PAGE_W - MARGIN, baseY - 1);
    ctx.y = baseY - 4;
  }
  ctx.y -= 6;
}

function drawPaymentStatusCell(
  ctx: PdfCanvas,
  x: number,
  rowTop: number,
  width: number,
  height: number,
  rawStatus: string,
  colorize: boolean,
) {
  const cell = colorize ? formatPaymentStatusCell(rawStatus) : rawStatus;
  const visual = colorize ? resolvePaymentStatusVisual(rawStatus) : null;
  const baseY = rowTop - height;

  if (visual?.bg) {
    ctx.page.drawRectangle({
      x: x + 0.5,
      y: baseY + 0.5,
      width: width - 1,
      height: height - 1,
      color: visual.bg,
      borderColor: BORDER,
      borderWidth: 0.25,
    });
  }

  if (!cell) return;

  const font =
    visual && ['dpd_90plus', 'doubtful', 'loss', 'settled', 'written_off'].includes(visual.category)
      ? ctx.fonts.bold
      : ctx.fonts.regular;
  const color = visual?.fg ?? TEXT;
  const size = TYPE.caption;
  const text = pdfSafeText(cell);
  const textW = font.widthOfTextAtSize(text, size);
  ctx.page.drawText(text, {
    x: x + Math.max(2, (width - textW) / 2),
    y: baseY + 4,
    size,
    font,
    color,
  });
}

function drawPaymentStatusLegend(ctx: PdfCanvas) {
  ctx.ensure(56);
  ctx.y = ctx.drawText('Payment status legend', MARGIN, ctx.y, TYPE.bodySm, { bold: true, color: CIBIL_NAVY });
  ctx.y -= 8;

  const swatch = 10;
  const gap = 6;
  const itemW = CONTENT_W / 2;
  let column = 0;
  let rowY = ctx.y;

  for (const item of PAYMENT_STATUS_LEGEND) {
    if (!item.legendLabel) continue;
    const x = MARGIN + column * itemW;
    if (item.bg) {
      ctx.page.drawRectangle({
        x,
        y: rowY - swatch,
        width: swatch,
        height: swatch,
        color: item.bg,
        borderColor: BORDER,
        borderWidth: 0.35,
      });
    }
    ctx.page.drawText(pdfSafeText(item.legendLabel), {
      x: x + swatch + gap,
      y: rowY - swatch + 2,
      size: TYPE.caption,
      font: ctx.fonts.regular,
      color: MUTED,
    });

    column += 1;
    if (column >= 2) {
      column = 0;
      rowY -= 14;
    }
  }

  ctx.y = rowY - (column === 0 ? 10 : 14);
}

function drawEnquiryDetails(ctx: PdfCanvas, inquiries: CibilReportInquiryRow[]) {
  if (ctx.y < 120) ctx.newPage();
  ctx.tealHeader('ENQUIRY DETAILS');
  ctx.y = ctx.drawText(
    '(*) Indicates the value provided by bank when you applied for a credit facility.',
    MARGIN,
    ctx.y,
    TYPE.caption,
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
    x: midX - ctx.fonts.bold.widthOfTextAtSize('End of report', TYPE.subheading) / 2,
    y: ctx.y + 4,
    size: TYPE.subheading,
    font: ctx.fonts.bold,
    color: CIBIL_NAVY,
  });
  ctx.y -= 18;

  const disclaimer =
    'Disclaimer: All information contained in this credit report has been collated by TransUnion CIBIL Limited (TU CIBIL) based on information provided/submitted by its Members. This internal reproduction from TrueLink bureau data is for operational use; refer to the official bureau portal for the authoritative report.';
  ctx.y = ctx.drawText(disclaimer, MARGIN, ctx.y, TYPE.caption, { color: MUTED, maxWidth: CONTENT_W });
  ctx.y -= 10;
  ctx.y = ctx.drawText(
    'COPYRIGHT 2026 TRANSUNION CIBIL. ALL RIGHTS RESERVED. For more information, visit www.cibil.com',
    MARGIN,
    ctx.y,
    TYPE.caption,
    { color: MUTED, maxWidth: CONTENT_W },
  );
  if (data.vendorHtmlUrl) {
    ctx.drawText(`Bureau portal: ${data.vendorHtmlUrl}`, MARGIN, ctx.y - 4, TYPE.caption, {
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
