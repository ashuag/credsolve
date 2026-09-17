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
  ACCOUNT_TYPE_LABELS,
  CIBIL_CREDIT_CARD_ACCOUNT_TYPE_SYMBOLS,
  CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS,
  formatCibilEnquiryPurposeLabel,
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

function accountConditionAbbreviation(node: unknown): string {
  const rec = asRecord(node);
  if (!rec) return '';
  return String(rec.abbreviation ?? rec.Abbreviation ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isCreditFacilityStatusNode(node: unknown): boolean {
  return accountConditionAbbreviation(node) === 'creditfacilitystatus';
}

/** Tenacio wraps TUEF Tag 34 onto AccountCondition with abbreviation `suitFiledStatus`. */
function isSuitFiledAccountCondition(node: unknown): boolean {
  const abbr = accountConditionAbbreviation(node);
  return (
    abbr === 'suitfiledstatus' ||
    abbr === 'suitfiledwilfuldefault' ||
    abbr === 'suitfiledwilfuldefaultstatus'
  );
}

/**
 * AccountCondition is a catch-all on TrueLink. Tag 33 fall-through is only valid
 * when the node is unlabeled (or itself a write-off / settled node). Credit
 * Facility Status and Suit Filed / Wilful Default share numeric codes with Tag 33
 * (`01` = restructure vs suit filed) so labeled nodes must not be read as Tag 33.
 */
function isNonWrittenOffSettledAccountCondition(node: unknown): boolean {
  return isCreditFacilityStatusNode(node) || isSuitFiledAccountCondition(node);
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

  const fromWrittenOffSettled = normalizeTuefStatusCode(readSymbol(lineRec.WrittenOffSettled));
  if (fromWrittenOffSettled) return fromWrittenOffSettled;

  if (isNonWrittenOffSettledAccountCondition(lineRec.AccountCondition)) return null;

  return normalizeTuefStatusCode(readSymbol(lineRec.AccountCondition));
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

  if (partitionSymbol != null && String(partitionSymbol).trim()) {
    return normalizeCibilAccountTypeSymbol(partitionSymbol);
  }
  if (fromGranted) return fromGranted;
  const description =
    lineRec.accountTypeDescription != null ? String(lineRec.accountTypeDescription).trim() : '';
  return description ? normalizeCibilAccountTypeSymbol(description) : null;
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
    if (node == null || node === '') continue;
    const symbol = normalizeTuefStatusCode(readSymbol(node));
    if (symbol) return symbol;
    const rec = asRecord(node);
    if (!rec) {
      const fromText = normalizeSuitFiledWilfulDefaultText(node);
      if (fromText) return fromText;
      continue;
    }
    const description = rec.description ?? rec.Description;
    if (description == null || String(description).trim() === '') continue;
    const fromDescription = normalizeSuitFiledWilfulDefaultText(description);
    if (fromDescription) return fromDescription;
  }

  if (isSuitFiledAccountCondition(lineRec.AccountCondition)) {
    return normalizeTuefStatusCode(readSymbol(lineRec.AccountCondition));
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

function nonEmptyInquiryText(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'object') {
    const fromSymbol = readSymbol(raw);
    if (fromSymbol) return fromSymbol;
    const rec = asRecord(raw);
    if (!rec) return null;
    for (const key of ['description', 'Description', 'name', 'Name', 'text', 'Text']) {
      const nested = rec[key];
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
    return null;
  }
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function readInquiryTypeCode(raw: unknown): string | null {
  const s = nonEmptyInquiryText(raw);
  if (!s) return null;
  return /^\d+$/.test(s) ? s.padStart(2, '0') : s;
}

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
      map.set(controlNumber, {
        date,
        inquiryType: readInquiryTypeCode(inq.inquiryPurpose),
        controlNumber,
        subscriberName: nonEmptyInquiryText(inq.memberShortName),
        amount: nonEmptyInquiryText(inq.inquiryAmount),
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
        const fromOriginal = controlNumber ? originalDataMap.get(controlNumber) ?? null : null;
        // TrueLinkCreditReport dates can be malformed (e.g. month=20); fall back to OriginalData date
        const date =
          parseCibilDate(inquiry.inquiryDate) ??
          fromOriginal?.date ??
          null;
        if (!date) continue;
        push({
          date,
          inquiryType:
            readInquiryTypeCode(inquiry.inquiryType ?? inquiry.InquiryType) ??
            fromOriginal?.inquiryType ??
            null,
          controlNumber,
          subscriberName:
            nonEmptyInquiryText(
              inquiry.subscriberName ??
                inquiry.memberShortName ??
                inquiry.memberName ??
                inquiry.MemberName ??
                inquiry.member,
            ) ?? fromOriginal?.subscriberName ?? null,
          amount:
            nonEmptyInquiryText(inquiry.amount ?? inquiry.enquiryAmount) ??
            fromOriginal?.amount ??
            null,
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
  /** No DPD > 0 on open loan tradelines within this many months. Null skips the rule. */
  openDpdMonths: number | null;
  dpd30PlusMonths: number | null;
  dpd60PlusMonths: number | null;
  dpd90PlusMonths: number | null;
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
    if (lookback == null) continue;
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

  const results: BureauDpdRuleResult[] = [];
  for (const { ruleKey, thresholdKey, minDpd, onlyOpenLoan } of DPD_WINDOW_RULES) {
    const lookback = thresholds[thresholdKey];
    if (lookback == null) continue;
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

    if (!findings.length) {
      results.push({ ruleKey, passed: true, detail: null, findings: [] });
      continue;
    }
    const detail = findings.map((f) => `${f.title}: ${f.detail ?? ''}`.trim()).join(' ');
    results.push({ ruleKey, passed: false, detail, findings });
  }
  return results;
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
 * Rejects when any CIBIL loan/account type has overdue (amount past due)
 * greater than `maxAllowedInr`. Overdue is summed per TUEF account type.
 */
export function auditLoanTypeOverdue(
  body: unknown,
  maxAllowedInr: number,
): BureauTradelineRuleCheck {
  const byType = new Map<
    string,
    {
      label: string;
      totalInr: number;
      lines: Array<{
        creditor: string;
        overdueInr: number;
        accountNumber: string | null;
        isOpen: boolean;
      }>;
    }
  >();

  walkTradelines(body, ({ lineRec, partitionSymbol, creditor }) => {
    const granted = asRecord(lineRec.GrantedTrade);
    const overdueInr = parseAssessmentAmountInr(granted?.amountPastDue ?? lineRec.amountPastDue);
    const accountType =
      resolveTradelineAccountTypeSymbol(partitionSymbol, lineRec) ??
      normalizeCibilAccountTypeSymbol(partitionSymbol) ??
      'UNKNOWN';
    const label = cibilAccountTypeDisplayLabel(accountType === 'UNKNOWN' ? null : accountType);
    const bucket = byType.get(accountType) ?? { label, totalInr: 0, lines: [] };
    bucket.totalInr += overdueInr;
    if (overdueInr > 0) {
      const accountNumber =
        lineRec.accountNumber != null ? String(lineRec.accountNumber).trim() : null;
      bucket.lines.push({
        creditor,
        overdueInr,
        accountNumber: accountNumber || null,
        isOpen: isCibilTradelineOpen(lineRec),
      });
    }
    byType.set(accountType, bucket);
  });

  const findings: BureauRuleFinding[] = [];
  const failingSummaries: string[] = [];
  for (const [symbol, bucket] of byType) {
    if (bucket.totalInr <= maxAllowedInr) continue;
    failingSummaries.push(`${bucket.label} ${bucket.totalInr} INR`);
    findings.push({
      title: bucket.label,
      detail: `Loan type overdue amount ${bucket.totalInr} INR exceeds maximum ${maxAllowedInr} INR.`,
      data: {
        accountType: symbol,
        loanType: bucket.label,
        overdueAmountInr: bucket.totalInr,
        maxAllowedInr,
        tradelineCount: bucket.lines.length,
      },
    });
    for (const line of bucket.lines) {
      findings.push({
        title: line.creditor,
        detail: `${bucket.label} overdue ${line.overdueInr} INR${line.isOpen ? '' : ' (closed)'}.`,
        data: {
          accountType: symbol,
          overdueAmountInr: line.overdueInr,
          accountNumber: line.accountNumber,
          isOpen: line.isOpen,
        },
      });
    }
  }

  return {
    passed: findings.length === 0,
    detail: failingSummaries.length
      ? `Overdue amount on loan type(s): ${failingSummaries.join('; ')} (max allowed ${maxAllowedInr} INR).`
      : null,
    findings,
  };
}

export function checkLoanTypeOverdue(body: unknown, maxAllowedInr: number): BureauAdverseTradelineCheck {
  const audit = auditLoanTypeOverdue(body, maxAllowedInr);
  return { passed: audit.passed, detail: audit.detail };
}

/**
 * Rejects when any tradeline's CIBIL account type is in `loanTypeIds`.
 * When `openOnly` is true, closed matching tradelines are ignored.
 */
export function auditRejectedLoanTypes(
  body: unknown,
  loanTypeIds: readonly string[],
  options: { openOnly: boolean },
): BureauTradelineRuleCheck {
  const blocked = new Set(
    loanTypeIds
      .map((id) => normalizeCibilAccountTypeSymbol(id))
      .filter((id): id is string => Boolean(id)),
  );
  if (!blocked.size) {
    return { passed: true, detail: null, findings: [] };
  }

  const findings: BureauRuleFinding[] = [];
  walkTradelines(body, ({ lineRec, partitionSymbol, creditor }) => {
    const isOpen = isCibilTradelineOpen(lineRec);
    if (options.openOnly && !isOpen) return;

    const accountType =
      resolveTradelineAccountTypeSymbol(partitionSymbol, lineRec) ??
      normalizeCibilAccountTypeSymbol(partitionSymbol);
    if (!accountType || !blocked.has(accountType)) return;

    const label = cibilAccountTypeDisplayLabel(accountType);
    const accountNumber =
      lineRec.accountNumber != null ? String(lineRec.accountNumber).trim() : null;
    findings.push({
      title: creditor,
      detail: options.openOnly
        ? `Open ${label} (${accountType}) tradeline is in the rejected open loan-type set.`
        : `${label} (${accountType}) tradeline is in the rejected loan-type set${isOpen ? '' : ' (closed)'}.`,
      data: {
        accountType,
        loanType: label,
        isOpen,
        accountNumber: accountNumber || null,
      },
    });
  });

  const labels = [
    ...new Set(findings.map((f) => String(f.data?.loanType ?? f.data?.accountType ?? '')).filter(Boolean)),
  ];
  return {
    passed: findings.length === 0,
    detail: findings.length
      ? options.openOnly
        ? `Open rejected loan type(s) found: ${labels.join(', ')}.`
        : `Rejected loan type(s) found: ${labels.join(', ')}.`
      : null,
    findings,
  };
}

export function checkRejectedLoanTypes(
  body: unknown,
  loanTypeIds: readonly string[],
  options: { openOnly: boolean },
): BureauAdverseTradelineCheck {
  const audit = auditRejectedLoanTypes(body, loanTypeIds, options);
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
  const trimmed = code.trim();
  if (!trimmed) return 'Unknown';
  if (/^\d+$/.test(trimmed)) {
    const norm = trimmed.padStart(2, '0');
    return formatCibilEnquiryPurposeLabel(ACCOUNT_TYPE_LABELS[norm] ?? `Purpose ${norm}`);
  }
  return formatCibilEnquiryPurposeLabel(ACCOUNT_TYPE_LABELS[trimmed] ?? trimmed);
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
  isUnsecured: boolean;
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
  const unsecuredMin =
    input.activeRuleIds.has(EC.MIN_UNSECURED_LOAN_AMOUNT) && input.isOpen && input.isUnsecured
      ? [EC.MIN_UNSECURED_LOAN_AMOUNT]
      : [];
  const overdue = input.activeRuleIds.has(EC.MAX_LOAN_TYPE_OVERDUE_AMOUNT)
    ? [EC.MAX_LOAN_TYPE_OVERDUE_AMOUNT]
    : [];
  const rejectOpen =
    input.activeRuleIds.has(EC.REJECT_OPEN_LOAN_TYPES) && input.isOpen
      ? [EC.REJECT_OPEN_LOAN_TYPES]
      : [];
  const rejectAny = input.activeRuleIds.has(EC.REJECT_LOAN_TYPES) ? [EC.REJECT_LOAN_TYPES] : [];
  return [...always, ...mfi, ...dpd, ...unsecuredMin, ...overdue, ...rejectOpen, ...rejectAny];
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
        isUnsecured: Boolean(
          partitionSymbol && CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS.has(partitionSymbol),
        ),
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

// ---------------------------------------------------------------------------
// CIBIL credit-assessment signals (loan-count category, hard/conditional
// underwriting rules, payment-probability model — the "before post-BRE" engine).
// ---------------------------------------------------------------------------

function classifyAssetStatusCode(raw: unknown): 'SMA' | 'SUB' | 'DBT' | 'LSS' | null {
  const code = normalizePayStatus(raw);
  if (!code) return null;
  if (code === 'SMA' || code.startsWith('SMA')) return 'SMA';
  if (code === 'SUB') return 'SUB';
  if (code === 'DBT') return 'DBT';
  if (code === 'LSS' || code === 'LOSS') return 'LSS';
  return null;
}

/** Parses a CIBIL amount field to a non-negative INR number, treating the `-1` sentinel as 0. */
function parseAssessmentAmountInr(raw: unknown): number {
  if (isCibilSentinelAmount(raw)) return 0;
  const n = Number.parseInt(String(raw).replace(/,/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type CibilAssessmentSignals = {
  riskScore: number | null;
  noOfLoans: number;
  noOfCreditCards: number;
  noOfSecuredLoans: number;
  noOfUnsecuredLoans: number;
  /** Open unsecured tradelines only (same unsecured set as `noOfUnsecuredLoans`). */
  noOfActiveUnsecuredLoans: number;
  noOfGoldLoans: number;
  sixMonthEnquiries: number;
  totalEnquiries: number;
  totalOverdueAmountInr: number;
  /** TUEF Tag 34 codes 02/03 — wilful default, with or without suit filed. */
  hasWilfulDefault: boolean;
  /** TUEF Tag 34 code 01 only — suit filed without wilful default. */
  hasSuitFiledOnly: boolean;
  /** Current pay status / account condition classified as Doubtful. */
  hasActiveDbt: boolean;
  /** Current pay status / account condition classified as Loss. */
  hasActiveLss: boolean;
  /** Current pay status / account condition classified as Substandard. */
  hasActiveSub: boolean;
  /** SUB/DBT/LSS classification (current or monthly history) within the last 18 months. */
  doubtfulOrLossInLast18MonthsCount: number;
  /** Wilful/suit-filed/settled events within the last 18 months. */
  defaultsInLast18MonthsCount: number;
  restructuredLoansCount: number;
  /** TUEF Tag 33 code 04 — Post (Write-Off) Settled. */
  pwosTradelinesCount: number;
  /** TUEF Tag 33 codes 03/04/09 — Settled family. */
  settledLoansCount: number;
  writeoffPresent: boolean;
  writeoffTotalAmountInr: number;
  dpd30InLast3MonthsCount: number;
  dpd60InLast9MonthsCount: number;
  dpd90InLast12MonthsCount: number;
  openLoanDpdInLast6MonthsCount: number;
  missedPaymentsInLast6MonthsCount: number;
};

const SETTLED_WRITTEN_OFF_STATUS_CODES = new Set(['03', '04', '09']);
const WRITEOFF_WRITTEN_OFF_STATUS_CODES = new Set(['02', '06', '08']);
const PWOS_WRITTEN_OFF_STATUS_CODE = '04';

/**
 * Derives every input signal the CIBIL credit-assessment engine (category, hard/conditional
 * rejection rules, payment probability) needs directly from the raw bureau payload — the
 * "before post-BRE" equivalent of the flattened CSV columns in the CIBIL assessment doc.
 */
export function computeCibilAssessmentSignals(
  body: unknown,
  riskScore: number | null,
  asOf: Date = new Date(),
): CibilAssessmentSignals {
  const parsedReport = parseBureauReport(body, asOf);
  const bureauAsOf = parsedReport.bureauAsOfDate;

  let noOfLoans = 0;
  let noOfCreditCards = 0;
  let noOfSecuredLoans = 0;
  let noOfUnsecuredLoans = 0;
  let noOfActiveUnsecuredLoans = 0;
  let noOfGoldLoans = 0;
  let totalOverdueAmountInr = 0;
  let hasWilfulDefault = false;
  let hasSuitFiledOnly = false;
  let hasActiveDbt = false;
  let hasActiveLss = false;
  let hasActiveSub = false;
  let doubtfulOrLossInLast18MonthsCount = 0;
  let defaultsInLast18MonthsCount = 0;
  let pwosTradelinesCount = 0;
  let settledLoansCount = 0;
  let writeoffPresent = false;
  let writeoffTotalAmountInr = 0;

  walkTradelines(parsedReport, ({ lineRec, partitionSymbol }) => {
    noOfLoans += 1;

    const parsed = parseCibilTradeline(lineRec, partitionSymbol);
    if (parsed) {
      if (parsed.accountTypeSymbol && CIBIL_CREDIT_CARD_ACCOUNT_TYPE_SYMBOLS.has(parsed.accountTypeSymbol)) {
        noOfCreditCards += 1;
      }
      if (parsed.accountTypeSymbol === '07') noOfGoldLoans += 1;
      if (parsed.isUnsecured) {
        noOfUnsecuredLoans += 1;
        if (parsed.isOpen) noOfActiveUnsecuredLoans += 1;
      } else {
        noOfSecuredLoans += 1;
      }
    }

    const granted = asRecord(lineRec.GrantedTrade);
    totalOverdueAmountInr += parseAssessmentAmountInr(granted?.amountPastDue);

    const reported = parseCibilDate(lineRec.dateReported);
    const reportedInLast18Months = !reported || isWithinLookbackMonths(reported, bureauAsOf, 18);

    const suitFiledCode = readSuitFiledWilfulDefaultCode(lineRec);
    const isWilful = suitFiledCode === '02' || suitFiledCode === '03';
    const isSuitFiledOnly = suitFiledCode === '01';
    if (isWilful) hasWilfulDefault = true;
    if (isSuitFiledOnly) hasSuitFiledOnly = true;

    const writtenOffCodes = readTradelineWrittenOffSettledStatusCodes(lineRec);
    const isSettled = writtenOffCodes.some((c) => SETTLED_WRITTEN_OFF_STATUS_CODES.has(c));
    const isWriteoff = writtenOffCodes.some((c) => WRITEOFF_WRITTEN_OFF_STATUS_CODES.has(c));
    const isPwos = writtenOffCodes.includes(PWOS_WRITTEN_OFF_STATUS_CODE);
    if (isSettled) settledLoansCount += 1;
    if (isPwos) pwosTradelinesCount += 1;
    if (isWriteoff) {
      writeoffPresent = true;
      writeoffTotalAmountInr += parseAssessmentAmountInr(lineRec.writtenOffAmtTotal);
    }

    if (reportedInLast18Months && ((isWilful || isSuitFiledOnly) || isSettled)) {
      defaultsInLast18MonthsCount += 1;
    }

    const currentClass =
      classifyAssetStatusCode(readSymbol(lineRec.PayStatus)) ??
      classifyAssetStatusCode(readSymbol(lineRec.AccountCondition));
    if (currentClass === 'DBT') hasActiveDbt = true;
    if (currentClass === 'LSS') hasActiveLss = true;
    if (currentClass === 'SUB') hasActiveSub = true;
    if (currentClass && ['SUB', 'DBT', 'LSS'].includes(currentClass) && reportedInLast18Months) {
      doubtfulOrLossInLast18MonthsCount += 1;
    }

    for (const entry of collectMonthlyPayStatusRows(lineRec)) {
      const monthClass = classifyAssetStatusCode(entry.status);
      if (monthClass && ['SUB', 'DBT', 'LSS'].includes(monthClass) && isWithinLookbackMonths(entry.monthDate, bureauAsOf, 18)) {
        doubtfulOrLossInLast18MonthsCount += 1;
      }
    }
  });

  const restructuredLoansCount = auditNoRestructuredLoans(parsedReport).findings.length;
  const missedPaymentsInLast6MonthsCount = auditMissedPayments(parsedReport, 6, Number.MAX_SAFE_INTEGER, bureauAsOf).findings.length;
  const sixMonthEnquiries = auditBureauEnquiriesInLastDays(parsedReport, 183, Number.MAX_SAFE_INTEGER, bureauAsOf).count;
  const totalEnquiries = extractBureauInquiries(parsedReport).length;

  const dpdByRule = new Map<string, number>(
    evaluateBureauDpdRulesDetailed(
      parsedReport,
      { dpd30PlusMonths: 3, dpd60PlusMonths: 9, dpd90PlusMonths: 12, openDpdMonths: 6 },
      bureauAsOf,
    ).map((r): [string, number] => [r.ruleKey, r.findings.length]),
  );

  return {
    riskScore,
    noOfLoans,
    noOfCreditCards,
    noOfSecuredLoans,
    noOfUnsecuredLoans,
    noOfActiveUnsecuredLoans,
    noOfGoldLoans,
    sixMonthEnquiries,
    totalEnquiries,
    totalOverdueAmountInr,
    hasWilfulDefault,
    hasSuitFiledOnly,
    hasActiveDbt,
    hasActiveLss,
    hasActiveSub,
    doubtfulOrLossInLast18MonthsCount,
    defaultsInLast18MonthsCount,
    restructuredLoansCount,
    pwosTradelinesCount,
    settledLoansCount,
    writeoffPresent,
    writeoffTotalAmountInr,
    dpd30InLast3MonthsCount: dpdByRule.get(EC.DPD_30PLUS_MONTHS) ?? 0,
    dpd60InLast9MonthsCount: dpdByRule.get(EC.DPD_60PLUS_MONTHS) ?? 0,
    dpd90InLast12MonthsCount: dpdByRule.get(EC.DPD_90PLUS_MONTHS) ?? 0,
    openLoanDpdInLast6MonthsCount: dpdByRule.get(EC.OPEN_DPD_MONTHS) ?? 0,
    missedPaymentsInLast6MonthsCount,
  };
}