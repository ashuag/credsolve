/**
 * Post-bureau eligibility rules over Tenacio / CIBIL soft-pull payloads.
 */
import {
  ADVERSE_PAY_STATUS_CODES,
  MORATORIUM_CREDIT_FACILITY_KEYWORDS,
  NEUTRAL_PAY_STATUS_CODES,
  TUEF_ADVERSE_SUIT_FILED_WILFUL_DEFAULT_CODES,
  TUEF_ADVERSE_WRITTEN_OFF_SETTLED_STATUS_CODES,
  TUEF_ADVERSE_WRITTEN_OFF_SETTLED_STATUS_LABELS,
  TUEF_MFI_ACCOUNT_TYPE_SYMBOLS,
  TUEF_NON_LOAN_ENQUIRY_PURPOSE_CODES,
  TUEF_RESTRUCTURED_STATUS_LABELS,
  TUEF_RESTRUCTURED_WRITTEN_OFF_SETTLED_CODES,
  TUEF_SMA_PWOS_ASSET_CLASSIFICATION_CODES,
  TUEF_SUIT_FILED_WILFUL_DEFAULT_LABELS,
  ACCOUNT_TYPE_LABELS
} from './cibil-tuef.constants';
import { ELIGIBILITY_CRITERIA as EC } from '../constants/eligibility-criteria.constants';
import {
  cibilAccountTypeDisplayLabel,
  extractTradelinesFromBureauVendorBody,
  isCibilTradelineOpen,
  normalizeCibilAccountTypeSymbol,
  parseCibilTradeline,
} from './cibil-tradeline.parser';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function resolvePayStatusHistory(lineRec: Record<string, unknown>): Record<string, unknown> | null {
  const direct = asRecord(lineRec.PayStatusHistory);
  if (direct) return direct;
  const granted = asRecord(lineRec.GrantedTrade);
  return granted ? asRecord(granted.PayStatusHistory) : null;
}

/** Parse CIBIL / ISO dates such as `2026-03-26+05:30` or `20260326`. */
export function parseCibilDate(raw: unknown): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthsBetween(start: Date, end: Date): number {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
}

function isWithinLookbackMonths(eventDate: Date, asOf: Date, lookbackMonths: number): boolean {
  const months = monthsBetween(eventDate, asOf);
  return months >= 0 && months < lookbackMonths;
}

function readSymbol(node: unknown): string | null {
  const rec = asRecord(node);
  if (!rec) return null;
  const raw = rec.symbol ?? rec.Symbol;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function normalizePayStatus(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase();
}

function isAdversePayStatus(raw: unknown): boolean {
  const code = normalizePayStatus(raw);
  if (!code) return false;
  if (NEUTRAL_PAY_STATUS_CODES.has(code)) return false;
  if (ADVERSE_PAY_STATUS_CODES.has(code)) return true;

  if (/^\d+$/.test(code)) {
    const n = Number.parseInt(code, 10);
    return Number.isFinite(n) && n >= 90;
  }

  return false;
}

function isSmaOrPwosPayStatus(raw: unknown): boolean {
  const code = normalizePayStatus(raw);
  return code.length > 0 && TUEF_SMA_PWOS_ASSET_CLASSIFICATION_CODES.has(code);
}

function normalizeTuefStatusCode(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s.padStart(2, '0');
  return s.toUpperCase();
}

/** TUEF Tag 33 — Written-off and Settled Status on TrueLink tradelines. */
function readWrittenOffSettledStatusCode(lineRec: Record<string, unknown>): string | null {
  const direct =
    lineRec.writtenOffSettledStatus ??
    lineRec.WrittenOffSettledStatus ??
    lineRec.writtenOffAndSettledStatus ??
    lineRec.WrittenOffAndSettledStatus;
  const fromDirect = normalizeTuefStatusCode(direct);
  if (fromDirect) return fromDirect;

  const fromSymbol =
    normalizeTuefStatusCode(readSymbol(lineRec.WrittenOffSettled)) ??
    normalizeTuefStatusCode(readSymbol(lineRec.AccountCondition));
  return fromSymbol;
}

function readGrantedWrittenOffSettledStatusCode(lineRec: Record<string, unknown>): string | null {
  const granted = asRecord(lineRec.GrantedTrade);
  if (!granted) return null;
  return (
    normalizeTuefStatusCode(granted.writtenOffSettledStatus) ??
    normalizeTuefStatusCode(granted.WrittenOffSettledStatus) ??
    normalizeTuefStatusCode(readSymbol(granted.WrittenOffSettled))
  );
}

function readTradelineWrittenOffSettledStatusCodes(lineRec: Record<string, unknown>): string[] {
  const codes = new Set<string>();
  const direct = readWrittenOffSettledStatusCode(lineRec);
  if (direct) codes.add(direct);
  const grantedCode = readGrantedWrittenOffSettledStatusCode(lineRec);
  if (grantedCode) codes.add(grantedCode);
  return [...codes];
}

/** Reads the Credit Facility Status text from various field name variants. */
function readCreditFacilityStatusText(lineRec: Record<string, unknown>): string | null {
  const raw =
    lineRec.CreditFacilityStatus ??
    lineRec.creditFacilityStatus ??
    lineRec.Credit_Facility_Status ??
    readSymbol(lineRec.CreditFacilityStatus);
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

/** Returns true when the credit facility status text contains a moratorium/regulatory keyword. */
function isMoratoriumCreditFacilityStatus(lineRec: Record<string, unknown>): boolean {
  const text = readCreditFacilityStatusText(lineRec)?.toUpperCase();
  if (!text) return false;
  return MORATORIUM_CREDIT_FACILITY_KEYWORDS.some((kw) => text.includes(kw));
}

function tradelineHasRestructureSignal(lineRec: Record<string, unknown>): boolean {
  return (
    readTradelineWrittenOffSettledStatusCodes(lineRec).some((c) =>
      TUEF_RESTRUCTURED_WRITTEN_OFF_SETTLED_CODES.has(c),
    ) || isMoratoriumCreditFacilityStatus(lineRec)
  );
}

function findAdverseWrittenOffSettledStatus(
  lineRec: Record<string, unknown>,
): { code: string; label: string } | null {
  const code = readTradelineWrittenOffSettledStatusCodes(lineRec).find((c) =>
    TUEF_ADVERSE_WRITTEN_OFF_SETTLED_STATUS_CODES.has(c),
  );
  return code ? { code, label: TUEF_ADVERSE_WRITTEN_OFF_SETTLED_STATUS_LABELS[code] ?? code } : null;
}

type MonthlyPayStatusRow = {
  monthDate: Date;
  status: unknown;
};

function collectMonthlyPayStatusRows(lineRec: Record<string, unknown>): MonthlyPayStatusRow[] {
  const payHistory = resolvePayStatusHistory(lineRec);
  if (!payHistory) return [];

  const structured: MonthlyPayStatusRow[] = asArray(payHistory.MonthlyPayStatus).flatMap((entry) => {
    const entryRec = asRecord(entry);
    if (!entryRec) return [];
    const monthDate = parseCibilDate(entryRec.date);
    return monthDate ? [{ monthDate, status: entryRec.status }] : [];
  });

  if (structured.length > 0 || typeof payHistory.status !== 'string') return structured;

  const statuses = String(payHistory.status).split(',').map((s) => s.trim()).filter(Boolean);
  const end = parseCibilDate(payHistory.endDate);
  const start = parseCibilDate(payHistory.startDate);

  return statuses.flatMap((status, i) => {
    let monthDate: Date | null = null;
    if (end) {
      monthDate = new Date(end);
      monthDate.setUTCMonth(monthDate.getUTCMonth() - (statuses.length - 1 - i));
    } else if (start) {
      monthDate = new Date(start);
      monthDate.setUTCMonth(monthDate.getUTCMonth() + i);
    }
    return monthDate ? [{ monthDate, status }] : [];
  });
}

function isMfiAccountType(symbol: string | null): boolean {
  const norm = symbol ? normalizeCibilAccountTypeSymbol(symbol) : null;
  return norm != null && TUEF_MFI_ACCOUNT_TYPE_SYMBOLS.has(norm);
}

function resolveTradelineAccountTypeSymbol(
  partitionSymbol: string | null,
  lineRec: Record<string, unknown>,
): string | null {
  if (isMfiAccountType(partitionSymbol)) return normalizeCibilAccountTypeSymbol(partitionSymbol);

  const granted = asRecord(lineRec.GrantedTrade);
  const fromGranted =
    readSymbol(granted?.AccountType) ?? readSymbol(granted?.CreditType);
  if (isMfiAccountType(fromGranted)) return normalizeCibilAccountTypeSymbol(fromGranted);

  if (partitionSymbol != null) return normalizeCibilAccountTypeSymbol(partitionSymbol);
  return fromGranted;
}

function isMicrofinanceTradeline(partitionSymbol: string | null, lineRec: Record<string, unknown>): boolean {
  const accountType = resolveTradelineAccountTypeSymbol(partitionSymbol, lineRec);
  if (isMfiAccountType(accountType)) return true;

  const industry = readSymbol(lineRec.IndustryCode);
  if (industry?.toUpperCase() === 'MFI') return true;

  const description = String(lineRec.accountTypeDescription ?? '').trim();
  if (/micro\s*finance/i.test(description)) return true;

  return false;
}

/** TUEF Tag 34 — Suit Filed / Wilful Default on TrueLink tradelines. */
export function readSuitFiledWilfulDefaultCode(lineRec: Record<string, unknown>): string | null {
  const direct =
    lineRec.suitFiledWilfulDefault ??
    lineRec.SuitFiledWilfulDefault ??
    lineRec.suitFiledStatus ??
    lineRec.SuitFiledStatus;
  const fromDirect = normalizeTuefStatusCode(direct);
  if (fromDirect) return fromDirect;

  for (const node of [lineRec.SuitFiled, lineRec.suitFiled]) {
    const symbol = normalizeTuefStatusCode(readSymbol(node));
    if (symbol) return symbol;
    const rec = asRecord(node);
    const fromDescription = normalizeSuitFiledWilfulDefaultText(rec?.description ?? rec?.Description);
    if (fromDescription) return fromDescription;
  }

  return null;
}

const SUIT_FILED_TEXT_RULES: [(text: string) => boolean, string][] = [
  [(t) => !t || t === '-' || t === 'no suit filed', '00'],
  [(t) => t.includes('wilful') && t.includes('suit'), '03'],
  [(t) => t.includes('wilful'), '02'],
  [(t) => t.includes('suit filed') || t === 'suit', '01'],
];

function normalizeSuitFiledWilfulDefaultText(raw: unknown): string | null {
  const text = String(raw ?? '').trim().toLowerCase();
  return SUIT_FILED_TEXT_RULES.find(([predicate]) => predicate(text))?.[1] ?? null;
}

export function isAdverseSuitFiledWilfulDefault(raw: unknown): boolean {
  const code =
    normalizeTuefStatusCode(raw) ??
    normalizeSuitFiledWilfulDefaultText(raw) ??
    normalizeSuitFiledWilfulDefaultText(readSymbol(raw));
  if (!code || code === '00') return false;
  if (TUEF_ADVERSE_SUIT_FILED_WILFUL_DEFAULT_CODES.has(code)) return true;

  const norm = normalizePayStatus(raw);
  return !!norm && norm !== '00' && norm !== 'NO SUIT FILED' && (norm.includes('WILFUL') || norm.includes('SUIT'));
}

export function formatSuitFiledWilfulDefaultLabel(lineRec: Record<string, unknown>): string {
  const code = readSuitFiledWilfulDefaultCode(lineRec);
  if (!code || code === '00') return '-';
  return TUEF_SUIT_FILED_WILFUL_DEFAULT_LABELS[code] ?? code;
}

function isLoanEnquiryPurpose(code: string | null): boolean {
  if (!code) return true;
  const norm = code.trim().padStart(2, '0');
  return !TUEF_NON_LOAN_ENQUIRY_PURPOSE_CODES.has(norm);
}

function walkTradelines(
  body: unknown,
  visit: (ctx: {
    lineRec: Record<string, unknown>;
    partitionSymbol: string | null;
    creditor: string;
  }) => void,
): void {
  if (body && typeof body === 'object' && 'isParsedCibilReport' in body) {
    for (const t of (body as ParsedCibilReport).tradelines) visit(t);
    return;
  }
  const tlr = readTrueLinkCreditReport(body);
  if (!tlr) return;

  for (const partition of asArray(tlr.TradeLinePartition)) {
    const partitionRec = asRecord(partition);
    if (!partitionRec) continue;
    const partitionSymbol =
      partitionRec.accountTypeSymbol != null
        ? String(partitionRec.accountTypeSymbol).trim()
        : null;

    for (const rawLine of asArray(partitionRec.Tradeline)) {
      const lineRec = asRecord(rawLine);
      if (!lineRec) continue;
      const creditor = String(lineRec.creditorName ?? 'account').trim() || 'account';
      visit({ lineRec, partitionSymbol, creditor });
    }
  }
}

/** CIBIL uses `-1` / empty when write-off or settlement amounts are not reported. */
export function isCibilSentinelAmount(raw: unknown): boolean {
  if (raw == null) return true;
  const s = String(raw).trim();
  return !s || s === '-1' || s === '-1.00';
}

function readTrueLinkCreditReport(body: unknown): Record<string, unknown> | null {
  const root = asRecord(body);
  if (!root) return null;
  const data = asRecord(root.data);
  const cibilData = data ? asRecord(data.cibilData) : null;
  const gcr = cibilData ? asRecord(cibilData.GetCustomerAssetsResponse) : null;
  const success = gcr ? asRecord(gcr.GetCustomerAssetsSuccess) : null;
  if (!success) return null;
  let asset = success.Asset;
  if (Array.isArray(asset)) asset = asset[0];
  const assetRec = asRecord(asset);
  return assetRec ? asRecord(assetRec.TrueLinkCreditReport) : null;
}

export type BureauAdverseTradelineCheck = {
  passed: boolean;
  /** Human-readable detail when `passed` is false. */
  detail: string | null;
};

export type BureauRuleFinding = {
  title: string;
  detail?: string | null;
  data?: Record<string, string | number | boolean | null>;
};

function formatCibilDateLabel(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export type ParsedBureauTradeline = {
  lineRec: Record<string, unknown>;
  partitionSymbol: string | null;
  creditor: string;
};

export type ParsedCibilReport = {
  isParsedCibilReport: true;
  tlr: Record<string, unknown> | null;
  tradelines: ParsedBureauTradeline[];
  enquiries: ParsedBureauInquiry[];
  bureauAsOfDate: Date;
};

export function parseBureauReport(
  rawPayload: unknown,
  asOf: Date = new Date()
): ParsedCibilReport {
  if (rawPayload && typeof rawPayload === 'object' && 'isParsedCibilReport' in rawPayload) {
    return rawPayload as ParsedCibilReport;
  }
  const tlr = readTrueLinkCreditReport(rawPayload);
  const tradelines: ParsedBureauTradeline[] = [];
  if (tlr) {
    for (const partition of asArray(tlr.TradeLinePartition)) {
      const partitionRec = asRecord(partition);
      if (!partitionRec) continue;
      const partitionSymbol = partitionRec.accountTypeSymbol != null ? String(partitionRec.accountTypeSymbol).trim() : null;
      for (const rawLine of asArray(partitionRec.Tradeline)) {
        const lineRec = asRecord(rawLine);
        if (!lineRec) continue;
        const creditor = String(lineRec.creditorName ?? 'account').trim() || 'account';
        tradelines.push({ lineRec, partitionSymbol, creditor });
      }
    }
  }
  const enquiries = extractBureauInquiries(rawPayload);
  return {
    isParsedCibilReport: true,
    tlr,
    tradelines,
    enquiries,
    bureauAsOfDate: resolveBureauAsOfDate(rawPayload, asOf)
  };
}

/**
 * Collects every adverse tradeline signal in the lookback window (LOS dry-run drill-down).
 */
export function auditNoAdverseTradelineInLookback(
  body: unknown,
  lookbackMonths: number,
  asOf: Date = new Date(),
): BureauAdverseTradelineCheck & { findings: BureauRuleFinding[] } {
  const findings: BureauRuleFinding[] = [];

  const tlr =
    body && typeof body === 'object' && 'isParsedCibilReport' in body
      ? (body as ParsedCibilReport).tlr
      : readTrueLinkCreditReport(body);

  if (!tlr) {
    findings.push({
      title: 'No TrueLink credit report',
      detail: 'Could not read TrueLinkCreditReport from bureau payload; tradeline rules were skipped.',
    });
    return { passed: true, detail: null, findings };
  }

  walkTradelines(body, ({ lineRec, partitionSymbol, creditor }) => {
    const parsed = parseCibilTradeline(lineRec, partitionSymbol);
    const reported = parseCibilDate(lineRec.dateReported);
    const reportedInLookback =
      !reported || isWithinLookbackMonths(reported, asOf, lookbackMonths);

    if (
      !isCibilSentinelAmount(lineRec.writtenOffAmtTotal) ||
      !isCibilSentinelAmount(lineRec.writtenOffPrincipal) ||
      !isCibilSentinelAmount(lineRec.settlementAmount)
    ) {
      if (reportedInLookback) {
        findings.push({
          title: creditor,
          detail: 'Write-off or settlement amount reported on tradeline (expected -1).',
          data: {
            source: 'TradeLinePartition',
            accountType: partitionSymbol,
            writtenOffAmtTotal: String(lineRec.writtenOffAmtTotal ?? ''),
            writtenOffPrincipal: String(lineRec.writtenOffPrincipal ?? ''),
            settlementAmount: String(lineRec.settlementAmount ?? ''),
            dateReported: formatCibilDateLabel(reported),
            lookbackMonths,
          },
        });
      }
    }

    const adverseWrittenOffSettled = findAdverseWrittenOffSettledStatus(lineRec);
    if (adverseWrittenOffSettled && reportedInLookback) {
      findings.push({
        title: creditor,
        detail: `Written-off / settled status: ${adverseWrittenOffSettled.label} (TUEF code ${adverseWrittenOffSettled.code}).`,
        data: {
          source: 'WrittenOffSettledStatus',
          writtenOffSettledStatus: adverseWrittenOffSettled.code,
          dateReported: formatCibilDateLabel(reported),
          lookbackMonths,
        },
      });
    }

    const suitFiledCode = readSuitFiledWilfulDefaultCode(lineRec);
    if (suitFiledCode && isAdverseSuitFiledWilfulDefault(suitFiledCode) && reportedInLookback) {
      findings.push({
        title: creditor,
        detail: `Suit filed / wilful default: ${TUEF_SUIT_FILED_WILFUL_DEFAULT_LABELS[suitFiledCode] ?? suitFiledCode}.`,
        data: {
          source: 'SuitFiledWilfulDefault',
          suitFiledWilfulDefault: suitFiledCode,
          dateReported: formatCibilDateLabel(reported),
          lookbackMonths,
        },
      });
    }

    const currentPayStatus = readSymbol(lineRec.PayStatus);
    if (currentPayStatus && isAdversePayStatus(currentPayStatus) && reportedInLookback) {
      findings.push({
        title: creditor,
        detail: `Current pay status "${currentPayStatus}" is doubtful / loss / written-off / settled.`,
        data: {
          source: 'PayStatus',
          payStatus: currentPayStatus,
          dateReported: formatCibilDateLabel(reported),
          lookbackMonths,
        },
      });
    }

    for (const entry of collectMonthlyPayStatusRows(lineRec)) {
      if (!isAdversePayStatus(entry.status)) continue;
      if (isWithinLookbackMonths(entry.monthDate, asOf, lookbackMonths)) {
        findings.push({
          title: creditor,
          detail: `Adverse monthly payment status "${String(entry.status)}".`,
          data: {
            source: 'MonthlyPayStatus',
            payStatus: String(entry.status),
            month: formatCibilDateLabel(entry.monthDate),
            lookbackMonths,
          },
        });
      }
    }

    const granted = asRecord(lineRec.GrantedTrade);
    const worst = granted ? readSymbol(granted.WorstPayStatus) : null;
    if (worst && isAdversePayStatus(worst) && reportedInLookback) {
      findings.push({
        title: creditor,
        detail: `Worst pay status "${worst}" on tradeline.`,
        data: {
          source: 'GrantedTrade.WorstPayStatus',
          worstPayStatus: worst,
          dateReported: formatCibilDateLabel(reported),
          lookbackMonths,
        },
      });
    }

    if (parsed) {
      const accountCondition = readSymbol(lineRec.AccountCondition);
      if (accountCondition && isAdversePayStatus(accountCondition) && reportedInLookback) {
        findings.push({
          title: creditor,
          detail: `Adverse account condition "${accountCondition}".`,
          data: {
            source: 'AccountCondition',
            accountCondition,
            dateReported: formatCibilDateLabel(reported),
            lookbackMonths,
          },
        });
      }
    }
  });

  const detail = findings[0]?.detail ? `${findings[0].title}: ${findings[0].detail}` : null;
  return { passed: findings.length === 0, detail, findings };
}

/**
 * No doubtful / loss / written-off / settled classification in the last `lookbackMonths`,
 * and tradeline write-off / settlement amount fields remain CIBIL sentinel (`-1`).
 */
export function checkNoAdverseTradelineInLookback(
  body: unknown,
  lookbackMonths: number,
  asOf: Date = new Date(),
): BureauAdverseTradelineCheck {
  const audit = auditNoAdverseTradelineInLookback(body, lookbackMonths, asOf);
  return { passed: audit.passed, detail: audit.detail };
}

export type ParsedBureauInquiry = {
  date: Date;
  inquiryType: string | null;
  controlNumber: string | null;
  subscriberName: string | null;
  amount: string | null;
};

/**
 * Decode base64 OriginalData and return a map of enqControlNum → ParsedBureauInquiry.
 * The TUEF data uses clean YYYYMMDD dates, unlike the TrueLinkCreditReport which can
 * have malformed dates (e.g. month=20).
 */
function buildOriginalDataInquiryMap(tlr: Record<string, unknown>): Map<string, ParsedBureauInquiry> {
  const map = new Map<string, ParsedBureauInquiry>();
  const sources = asRecord(tlr.Sources);
  const source = sources ? asRecord(sources.Source) : null;
  const raw = source?.OriginalData;
  if (!raw || typeof raw !== 'string') return map;

  let tuef: unknown;
  try {
    tuef = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return map;
  }

  const tuefRec = asRecord(tuef);
  const icrs = tuefRec ? asRecord(tuefRec.ICRS_SubjectInquiryByTUEF_Response) : null;
  if (!icrs) return map;

  for (const subjectNode of asArray(icrs.subject)) {
    const subject = asRecord(subjectNode);
    if (!subject) continue;
    for (const inqNode of asArray(subject.inquiry)) {
      const inq = asRecord(inqNode);
      if (!inq) continue;
      const controlNumber = inq.enqControlNum != null ? String(inq.enqControlNum).trim() : null;
      if (!controlNumber) continue;
      const date = parseCibilDate(inq.dateOfInquiry);
      if (!date) continue;
      const purposeRaw = inq.inquiryPurpose != null ? String(inq.inquiryPurpose).trim().padStart(2, '0') : null;
      map.set(controlNumber, {
        date,
        inquiryType: purposeRaw,
        controlNumber,
        subscriberName: inq.memberShortName != null ? String(inq.memberShortName).trim() : null,
        amount: inq.inquiryAmount != null ? String(inq.inquiryAmount).trim() : null,
      });
    }
  }
  return map;
}

/** Collect credit enquiries from TrueLink `InquiryPartition`, falling back to `OriginalData` TUEF. */
export function extractBureauInquiries(body: unknown): ParsedBureauInquiry[] {
  if (body && typeof body === 'object' && 'isParsedCibilReport' in body) {
    return (body as ParsedCibilReport).enquiries;
  }
  const out: ParsedBureauInquiry[] = [];
  const seen = new Set<string>();

  const push = (item: ParsedBureauInquiry) => {
    const key =
      item.controlNumber ??
      `${item.date.toISOString()}|${item.inquiryType ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };

  const tlr = readTrueLinkCreditReport(body);
  if (tlr) {
    const originalDataMap = buildOriginalDataInquiryMap(tlr);
    const partitions = asArray(tlr.InquiryPartition);
    if (partitions.length > 0) {
      for (const partition of partitions) {
        const partitionRec = asRecord(partition);
        const inquiry = partitionRec ? asRecord(partitionRec.Inquiry) : null;
        if (!inquiry) continue;
        const controlNumber = inquiry.enqControlNum != null ? String(inquiry.enqControlNum).trim() : null;
        // TrueLinkCreditReport dates can be malformed (e.g. month=20); fall back to OriginalData date
        const date = parseCibilDate(inquiry.inquiryDate) ?? (controlNumber ? originalDataMap.get(controlNumber)?.date ?? null : null);
        if (!date) continue;
        push({
          date,
          inquiryType: inquiry.inquiryType != null ? String(inquiry.inquiryType).trim() : null,
          controlNumber,
          subscriberName:
            inquiry.subscriberName != null ? String(inquiry.subscriberName).trim() : null,
          amount: inquiry.amount != null ? String(inquiry.amount).trim() : null,
        });
      }
    } else {
      for (const item of originalDataMap.values()) push(item);
    }
  }

  return out;
}

/** Count credit/loan enquiries in the last `windowDays` (default 30). */
export function countBureauEnquiriesInLastDays(
  body: unknown,
  windowDays: number,
  asOf: Date = new Date(),
): number {
  return auditBureauEnquiriesInLastDays(body, windowDays, Number.MAX_SAFE_INTEGER, asOf).count;
}

/** Lists enquiries in the rolling window with per-enquiry drill-down. */
export function auditBureauEnquiriesInLastDays(
  body: unknown,
  windowDays: number,
  maxAllowed: number,
  asOf: Date = new Date(),
): {
  passed: boolean;
  count: number;
  detail: string | null;
  findings: BureauRuleFinding[];
} {
  const windowStart = new Date(asOf);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);

  const inWindow = extractBureauInquiries(body).filter((inq) => {
    if (inq.date < windowStart || inq.date > asOf) return false;
    return isLoanEnquiryPurpose(inq.inquiryType);
  });
  const findings: BureauRuleFinding[] = inWindow.map((inq, index) => ({
    title: inq.subscriberName ?? `Enquiry ${index + 1}`,
    detail: inq.inquiryType ? `Purpose / type: ${inq.inquiryType}` : 'Credit enquiry in window',
    data: {
      inquiryDate: formatCibilDateLabel(inq.date),
      inquiryType: inq.inquiryType,
      controlNumber: inq.controlNumber,
      subscriberName: inq.subscriberName,
      amount: inq.amount,
      windowDays,
    },
  }));

  const count = inWindow.length;
  const passed = count <= maxAllowed;
  const detail = passed
    ? null
    : `Too many credit enquiries (${count}) in the last ${windowDays} days (max ${maxAllowed}).`;

  return { passed, count, detail, findings };
}

/** Exposed for tests — ensures tradeline walk still works on sample payloads. */
export function countTradelines(body: unknown): number {
  return extractTradelinesFromBureauVendorBody(body).length;
}

export type BureauDpdThresholds = {
  /** No DPD > 0 on open loan tradelines within this many months. */
  openDpdMonths: number;
  dpd30PlusMonths: number;
  dpd60PlusMonths: number;
  dpd90PlusMonths: number;
};

type MonthlyDpdEntry = {
  monthDate: Date;
  dpdDays: number;
  isOpen: boolean;
  accountLabel: string;
  /** Latest payment-history month for this tradeline (capped at bureau inquiry date). */
  lookbackAnchorDate: Date;
};

/** Bureau inquiry / report date used as the upper bound for DPD lookback windows. */
export function resolveBureauAsOfDate(body: unknown, fallback: Date = new Date()): Date {
  const tlr = readTrueLinkCreditReport(body);
  if (!tlr) return fallback;

  const sources = asRecord(tlr.Sources);
  const source = sources ? asRecord(sources.Source) : null;
  const inquiryDate = source?.InquiryDate ? parseCibilDate(source.InquiryDate) : null;
  if (inquiryDate) return inquiryDate;

  return fallback;
}

/** Map CIBIL monthly pay status to days past due (`null` = not a delinquency signal). */
export function parsePayStatusToDpdDays(raw: unknown): number | null {
  const code = normalizePayStatus(raw);
  if (!code) return null;
  if (code === '0' || code === '00' || code === '000') return 0;
  if (NEUTRAL_PAY_STATUS_CODES.has(code) || code === 'STD') return 0;
  if (ADVERSE_PAY_STATUS_CODES.has(code)) return 90;

  if (/^\d+$/.test(code)) {
    const n = Number.parseInt(code, 10);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function collectMonthlyDpdEntries(body: unknown, bureauAsOf: Date = new Date()): MonthlyDpdEntry[] {
  const entries: MonthlyDpdEntry[] = [];

  walkTradelines(body, ({ lineRec, creditor: accountLabel }) => {
    const isOpen = isCibilTradelineOpen(lineRec);

    const payHistory = resolvePayStatusHistory(lineRec);
    if (!payHistory) return;

    const pending: Array<Omit<MonthlyDpdEntry, 'lookbackAnchorDate'>> = [];
    let monthlyAdded = false;
    for (const entry of asArray(payHistory.MonthlyPayStatus)) {
      const entryRec = asRecord(entry);
      if (!entryRec) continue;
      const monthDate = parseCibilDate(entryRec.date);
      const dpdDays = parsePayStatusToDpdDays(entryRec.status);
      if (!monthDate || dpdDays == null) continue;
      pending.push({ monthDate, dpdDays, isOpen, accountLabel });
      monthlyAdded = true;
    }

    if (!monthlyAdded && typeof payHistory.status === 'string') {
      const statuses = String(payHistory.status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const end = parseCibilDate(payHistory.endDate);
      const start = parseCibilDate(payHistory.startDate);
      for (let i = 0; i < statuses.length; i++) {
        const dpdDays = parsePayStatusToDpdDays(statuses[i]);
        if (dpdDays == null) continue;
        let monthDate: Date | null = null;
        if (end) {
          monthDate = new Date(end);
          monthDate.setUTCMonth(monthDate.getUTCMonth() - (statuses.length - 1 - i));
        } else if (start) {
          monthDate = new Date(start);
          monthDate.setUTCMonth(monthDate.getUTCMonth() + i);
        }
        if (!monthDate) continue;
        pending.push({ monthDate, dpdDays, isOpen, accountLabel });
      }
    }

    if (!pending.length) return;

    const lookbackAnchorDate = bureauAsOf;
    for (const entry of pending) {
      entries.push({ ...entry, lookbackAnchorDate });
    }
  });

  return entries;
}

type DpdWindowRule = {
  ruleKey: BureauDpdRuleKey;
  thresholdKey: keyof BureauDpdThresholds;
  minDpd: number;
  onlyOpenLoan: boolean;
  detailLabel: string;
};

const DPD_WINDOW_RULES: DpdWindowRule[] = [
  { ruleKey: EC.DPD_90PLUS_MONTHS, thresholdKey: 'dpd90PlusMonths', minDpd: 90, onlyOpenLoan: false, detailLabel: '90+ DPD' },
  { ruleKey: EC.DPD_60PLUS_MONTHS, thresholdKey: 'dpd60PlusMonths', minDpd: 60, onlyOpenLoan: false, detailLabel: '60+ DPD' },
  { ruleKey: EC.DPD_30PLUS_MONTHS, thresholdKey: 'dpd30PlusMonths', minDpd: 30, onlyOpenLoan: false, detailLabel: '30+ DPD' },
  { ruleKey: EC.OPEN_DPD_MONTHS, thresholdKey: 'openDpdMonths', minDpd: 1, onlyOpenLoan: true, detailLabel: 'open loan DPD > 0' },
];

/**
 * DPD windows from bureau payment history (all tradelines + open loan accounts).
 * Thresholds align with `open_dpd_months`, `dpd_30plus_months`, etc. in eligibility criteria.
 */
export function checkBureauDpdRules(
  body: unknown,
  thresholds: BureauDpdThresholds,
  asOf: Date = new Date(),
): BureauAdverseTradelineCheck {
  const entries = collectMonthlyDpdEntries(body, asOf);

  for (const { thresholdKey, minDpd, onlyOpenLoan, detailLabel } of DPD_WINDOW_RULES) {
    const lookback = thresholds[thresholdKey];
    const hit = entries.find(
      (e) =>
        (!onlyOpenLoan || e.isOpen) &&
        isWithinLookbackMonths(e.monthDate, e.lookbackAnchorDate, lookback) &&
        e.dpdDays >= minDpd,
    );
    if (hit) {
      return {
        passed: false,
        detail: `${hit.accountLabel}: ${detailLabel} (${hit.dpdDays} days) in the last ${lookback} months.`,
      };
    }
  }

  return { passed: true, detail: null };
}

export type BureauDpdRuleKey =
  | typeof EC.OPEN_DPD_MONTHS
  | typeof EC.DPD_30PLUS_MONTHS
  | typeof EC.DPD_60PLUS_MONTHS
  | typeof EC.DPD_90PLUS_MONTHS;

export type BureauDpdRuleResult = {
  ruleKey: BureauDpdRuleKey;
  passed: boolean;
  detail: string | null;
  findings: BureauRuleFinding[];
};

/** Evaluates each DPD window separately (for LOS dry-run / diagnostics). */
export function evaluateBureauDpdRulesDetailed(
  body: unknown,
  thresholds: BureauDpdThresholds,
  asOf: Date = new Date(),
): BureauDpdRuleResult[] {
  const entries = collectMonthlyDpdEntries(body, asOf);

  return DPD_WINDOW_RULES.map(({ ruleKey, thresholdKey, minDpd, onlyOpenLoan }) => {
    const lookback = thresholds[thresholdKey];
    const findings: BureauRuleFinding[] = entries
      .filter(
        (e) =>
          (!onlyOpenLoan || e.isOpen) &&
          isWithinLookbackMonths(e.monthDate, e.lookbackAnchorDate, lookback) &&
          e.dpdDays >= minDpd,
      )
      .map((e) => ({
        title: e.accountLabel,
        detail: `${e.dpdDays} DPD in month ${formatCibilDateLabel(e.monthDate) ?? 'unknown'} (threshold ≥ ${minDpd} days).`,
        data: {
          account: e.accountLabel,
          month: formatCibilDateLabel(e.monthDate),
          dpdDays: e.dpdDays,
          openAccount: e.isOpen,
          lookbackMonths: lookback,
          minDpdDays: minDpd,
        },
      }));

    if (!findings.length) return { ruleKey, passed: true, detail: null, findings: [] };
    const detail = findings.map((f) => `${f.title}: ${f.detail ?? ''}`.trim()).join(' ');
    return { ruleKey, passed: false, detail, findings };
  });
}

export type BureauTradelineRuleCheck = BureauAdverseTradelineCheck & {
  findings: BureauRuleFinding[];
};

/** No restructured loan tradelines on the bureau report. */
export function auditNoRestructuredLoans(body: unknown): BureauTradelineRuleCheck {
  const findings: BureauRuleFinding[] = [];

  walkTradelines(body, ({ lineRec, partitionSymbol, creditor }) => {
    if (!tradelineHasRestructureSignal(lineRec)) return;
    const statusCode = readWrittenOffSettledStatusCode(lineRec);
    const statusLabel = statusCode ? TUEF_RESTRUCTURED_STATUS_LABELS[statusCode] : null;
    const moratoriumText = readCreditFacilityStatusText(lineRec);
    const isMoratorium = !statusCode && isMoratoriumCreditFacilityStatus(lineRec);
    findings.push({
      title: creditor,
      detail: statusLabel
        ? `Written-off / settled status: ${statusLabel} (TUEF code ${statusCode}).`
        : isMoratorium
          ? `Credit Facility Status: ${moratoriumText} — flagged as regulatory restructure.`
          : 'Tradeline flagged as restructured (TUEF Tag 33 — Written-off and Settled Status).',
      data: {
        accountType: partitionSymbol,
        writtenOffSettledStatus: statusCode ?? 'n/a',
        creditFacilityStatus: moratoriumText ?? 'n/a',
        accountCondition: readSymbol(lineRec.AccountCondition),
        source: 'TradeLinePartition',
      },
    });
  });

  return {
    passed: findings.length === 0,
    detail: findings[0]
      ? `${findings[0].title}: ${findings[0].detail ?? 'Restructured loan found.'}`
      : null,
    findings,
  };
}

export function checkNoRestructuredLoans(body: unknown): BureauAdverseTradelineCheck {
  const audit = auditNoRestructuredLoans(body);
  return { passed: audit.passed, detail: audit.detail };
}

/** No SMA / PWOS classification on any reported tradeline. */
export function auditNoSmaPwosTradelines(body: unknown): BureauTradelineRuleCheck {
  const findings: BureauRuleFinding[] = [];

  walkTradelines(body, ({ lineRec, partitionSymbol, creditor }) => {
    const payStatus = readSymbol(lineRec.PayStatus);
    if (payStatus && isSmaOrPwosPayStatus(payStatus)) {
      findings.push({
        title: creditor,
        detail: `Current pay status "${payStatus}" is SMA / PWOS.`,
        data: { source: 'PayStatus', payStatus, accountType: partitionSymbol },
      });
    }

    const granted = asRecord(lineRec.GrantedTrade);
    const worst = granted ? readSymbol(granted.WorstPayStatus) : null;
    if (worst && isSmaOrPwosPayStatus(worst)) {
      findings.push({
        title: creditor,
        detail: `Worst pay status "${worst}" is SMA / PWOS.`,
        data: { source: 'GrantedTrade.WorstPayStatus', worstPayStatus: worst, accountType: partitionSymbol },
      });
    }

    const payHistory = resolvePayStatusHistory(lineRec);
    if (payHistory) {
      for (const entry of asArray(payHistory.MonthlyPayStatus)) {
        const entryRec = asRecord(entry);
        if (!entryRec) continue;
        const status = entryRec.status;
        if (!isSmaOrPwosPayStatus(status)) continue;
        const monthDate = parseCibilDate(entryRec.date);
        findings.push({
          title: creditor,
          detail: `Monthly pay status "${String(status)}" is SMA / PWOS.`,
          data: {
            source: 'MonthlyPayStatus',
            payStatus: String(status),
            month: formatCibilDateLabel(monthDate),
            accountType: partitionSymbol,
          },
        });
      }
    }
  });

  return {
    passed: findings.length === 0,
    detail: findings[0]
      ? `${findings[0].title}: ${findings[0].detail ?? 'SMA / PWOS tradeline found.'}`
      : null,
    findings,
  };
}

export function checkNoSmaPwosTradelines(body: unknown): BureauAdverseTradelineCheck {
  const audit = auditNoSmaPwosTradelines(body);
  return { passed: audit.passed, detail: audit.detail };
}

/** No suit filed / wilful default on any tradeline (lifetime — no lookback limit). */
export function auditNoWilfulDefault(body: unknown): BureauTradelineRuleCheck {
  const findings: BureauRuleFinding[] = [];

  walkTradelines(body, ({ lineRec, partitionSymbol, creditor }) => {
    const code = readSuitFiledWilfulDefaultCode(lineRec);
    if (!code || !isAdverseSuitFiledWilfulDefault(code)) return;
    const label = TUEF_SUIT_FILED_WILFUL_DEFAULT_LABELS[code] ?? code;
    findings.push({
      title: creditor,
      detail: `Suit filed / wilful default: ${label} (TUEF code ${code}).`,
      data: {
        accountType: partitionSymbol,
        suitFiledWilfulDefault: code,
        label,
        dateReported: formatCibilDateLabel(parseCibilDate(lineRec.dateReported)),
      },
    });
  });

  return {
    passed: findings.length === 0,
    detail: findings[0]
      ? `${findings[0].title}: ${findings[0].detail ?? 'Wilful default / suit filed found.'}`
      : null,
    findings,
  };
}

export function checkNoWilfulDefault(body: unknown): BureauAdverseTradelineCheck {
  const audit = auditNoWilfulDefault(body);
  return { passed: audit.passed, detail: audit.detail };
}

/** No open microfinance (MFI) loan tradelines. */
export function auditNoActiveMfiLoans(body: unknown): BureauTradelineRuleCheck {
  const findings: BureauRuleFinding[] = [];

  walkTradelines(body, ({ lineRec, partitionSymbol, creditor }) => {
    if (!isCibilTradelineOpen(lineRec)) return;

    const accountType = resolveTradelineAccountTypeSymbol(partitionSymbol, lineRec);
    const industry = readSymbol(lineRec.IndustryCode);
    const mfiByType = isMicrofinanceTradeline(partitionSymbol, lineRec);

    if (!mfiByType) return;

    findings.push({
      title: creditor,
      detail: 'Open microfinance (MFI) loan tradeline on bureau report.',
      data: {
        accountType,
        industryCode: industry,
        open: true,
        source: isMfiAccountType(accountType) ? 'accountType' : 'IndustryCode',
      },
    });
  });

  return {
    passed: findings.length === 0,
    detail: findings[0]
      ? `${findings[0].title}: ${findings[0].detail ?? 'Active MFI loan found.'}`
      : null,
    findings,
  };
}

export function checkNoActiveMfiLoans(body: unknown): BureauAdverseTradelineCheck {
  const audit = auditNoActiveMfiLoans(body);
  return { passed: audit.passed, detail: audit.detail };
}

/**
 * Counts (tradeline × month) pairs where DPD > 0 in the last N months.
 * A "missed payment" is any month on any tradeline with positive DPD.
 */
export function auditMissedPayments(
  body: unknown,
  lookbackMonths: number,
  maxAllowed: number,
  asOf: Date = new Date(),
): BureauTradelineRuleCheck {
  const findings: BureauRuleFinding[] = collectMonthlyDpdEntries(body, asOf)
    .filter(
      (e) => e.dpdDays > 0 && isWithinLookbackMonths(e.monthDate, e.lookbackAnchorDate, lookbackMonths),
    )
    .map((e) => ({
      title: e.accountLabel,
      detail: `${e.dpdDays} DPD in ${formatCibilDateLabel(e.monthDate) ?? 'unknown'} — counted as missed payment.`,
      data: {
        account: e.accountLabel,
        month: formatCibilDateLabel(e.monthDate),
        dpdDays: e.dpdDays,
        lookbackMonths,
      },
    }));

  const passed = findings.length <= maxAllowed;
  return {
    passed,
    detail: passed
      ? null
      : `${findings.length} missed payment(s) in the last ${lookbackMonths} months (max allowed: ${maxAllowed}).`,
    findings,
  };
}

export type PostBreTradelineInspectionRow = {
  rowIndex: number;
  creditorName: string;
  accountNumber: string | null;
  accountTypeSymbol: string | null;
  accountTypeLabel: string;
  accountStatus: string;
  isOpen: boolean;
  isMfiAccount: boolean;
  restructureSignal: boolean;
  smaPwosSignal: boolean;
  /** Post-BRE check ids that scan this tradeline when those rules run. */
  evaluatedByRules: string[];
};

export type PostBreEnquiryInspectionRow = {
  inquiryDate: string;
  inquiryType: string | null;
  inquiryTypeLabel: string;
  subscriberName: string | null;
  controlNumber: string | null;
  amount: string | null;
  inRollingWindow: boolean;
  countsTowardLoanEnquiryLimit: boolean;
  excludeReason: string | null;
};

export type PostBreBureauSummary = {
  vendorRequestId: string | null;
  responseStatus: string | null;
  bureauInquiryDate: string | null;
  tradelineCount: number;
  openTradelineCount: number;
  closedTradelineCount: number;
  totalEnquiryCount: number;
  loanEnquiryCountInWindow: number;
  enquiryWindowDays: number;
};

function enquiryPurposeLabel(code: string | null): string {
  if (!code) return 'Unknown';
  const norm = code.trim().padStart(2, '0');
  return ACCOUNT_TYPE_LABELS[norm] ?? `Purpose ${norm}`;
}

function readBureauInquiryDate(body: unknown): string | null {
  const tlr = readTrueLinkCreditReport(body);
  if (!tlr) return null;
  const sources = asRecord(tlr.Sources);
  const source = sources ? asRecord(sources.Source) : null;
  if (!source?.InquiryDate) return null;
  const d = parseCibilDate(source.InquiryDate);
  return formatCibilDateLabel(d);
}

function tradelineHasSmaPwosSignal(lineRec: Record<string, unknown>): boolean {
  const payStatus = readSymbol(lineRec.PayStatus);
  if (payStatus && isSmaOrPwosPayStatus(payStatus)) return true;

  const granted = asRecord(lineRec.GrantedTrade);
  const worst = granted ? readSymbol(granted.WorstPayStatus) : null;
  if (worst && isSmaOrPwosPayStatus(worst)) return true;

  const payHistory = resolvePayStatusHistory(lineRec);
  if (payHistory) {
    for (const entry of asArray(payHistory.MonthlyPayStatus)) {
      const entryRec = asRecord(entry);
      if (entryRec && isSmaOrPwosPayStatus(entryRec.status)) return true;
    }
  }
  return false;
}

function resolveTradelineEvaluatedRules(input: {
  isOpen: boolean;
  isMfiAccount: boolean;
  activeRuleIds: Set<string>;
}): string[] {
  const always = [EC.SETTLED_MONTHS, EC.NO_RESTRUCTURED_LOANS, EC.NO_SMA_PWOS].filter((k) =>
    input.activeRuleIds.has(k),
  );
  const mfi =
    input.activeRuleIds.has(EC.NO_ACTIVE_MFI) && input.isMfiAccount && input.isOpen
      ? [EC.NO_ACTIVE_MFI]
      : [];
  const dpd = [EC.OPEN_DPD_MONTHS, EC.DPD_30PLUS_MONTHS, EC.DPD_60PLUS_MONTHS, EC.DPD_90PLUS_MONTHS].filter(
    (k) => input.activeRuleIds.has(k),
  );
  return [...always, ...mfi, ...dpd];
}

/** Every tradeline on the bureau report with flags and which post-BRE rules evaluate it. */
export function buildPostBreTradelineInspection(
  body: unknown,
  activeRuleIds: readonly string[],
): PostBreTradelineInspectionRow[] {
  const active = new Set(activeRuleIds);
  const rows: PostBreTradelineInspectionRow[] = [];
  let rowIndex = 0;

  walkTradelines(body, ({ lineRec, partitionSymbol, creditor }) => {
    const accountNumber =
      lineRec.accountNumber != null ? String(lineRec.accountNumber).trim() : null;
    const industry = readSymbol(lineRec.IndustryCode);
    const isMfi = isMicrofinanceTradeline(partitionSymbol, lineRec);
    const isOpen = isCibilTradelineOpen(lineRec);
    const accountStatus = isOpen ? 'Open' : 'Closed';

    rows.push({
      rowIndex: rowIndex + 1,
      creditorName: creditor,
      accountNumber: accountNumber || null,
      accountTypeSymbol: partitionSymbol,
      accountTypeLabel: cibilAccountTypeDisplayLabel(partitionSymbol),
      accountStatus,
      isOpen,
      isMfiAccount: isMfi,
      restructureSignal: tradelineHasRestructureSignal(lineRec),
      smaPwosSignal: tradelineHasSmaPwosSignal(lineRec),
      evaluatedByRules: resolveTradelineEvaluatedRules({
        isOpen,
        isMfiAccount: isMfi,
        activeRuleIds: active,
      }),
    });
    rowIndex += 1;
  });

  return rows;
}

/** All bureau enquiries with window / loan-purpose inclusion for post-BRE. */
export function buildPostBreEnquiryInspection(
  body: unknown,
  windowDays: number,
  asOf: Date = new Date(),
): PostBreEnquiryInspectionRow[] {
  const windowStart = new Date(asOf);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);

  return extractBureauInquiries(body).map((inq) => {
    const inRollingWindow = inq.date >= windowStart && inq.date <= asOf;
    const excludeReason: string | null = !inRollingWindow
      ? `Outside ${windowDays}-day window`
      : null;

    return {
      inquiryDate: formatCibilDateLabel(inq.date) ?? inq.date.toISOString().slice(0, 10),
      inquiryType: inq.inquiryType,
      inquiryTypeLabel: enquiryPurposeLabel(inq.inquiryType),
      subscriberName: inq.subscriberName,
      controlNumber: inq.controlNumber,
      amount: inq.amount,
      inRollingWindow,
      countsTowardLoanEnquiryLimit: inRollingWindow,
      excludeReason,
    };
  });
}

export function buildPostBreBureauSummary(
  body: unknown,
  parsed: { vendorRequestId: string | null; responseStatus: string | null },
  windowDays: number,
  asOf: Date = new Date(),
): PostBreBureauSummary {
  const tradelines = buildPostBreTradelineInspection(body, []);
  const openCount = tradelines.filter((t) => t.isOpen).length;
  const enquiries = buildPostBreEnquiryInspection(body, windowDays, asOf);
  const loanInWindow = enquiries.filter((e) => e.countsTowardLoanEnquiryLimit).length;

  return {
    vendorRequestId: parsed.vendorRequestId,
    responseStatus: parsed.responseStatus,
    bureauInquiryDate: readBureauInquiryDate(body),
    tradelineCount: tradelines.length,
    openTradelineCount: openCount,
    closedTradelineCount: tradelines.length - openCount,
    totalEnquiryCount: enquiries.length,
    loanEnquiryCountInWindow: loanInWindow,
    enquiryWindowDays: windowDays,
  };
}