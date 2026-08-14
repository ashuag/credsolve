/**
 * CIBIL assessment-engine input columns derived from a TrueLink bureau payload.
 * Column names follow the Credit Risk / Data Science CIBIL Assessment Process guide.
 */
import {
  CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS,
  TUEF_ADVERSE_SUIT_FILED_WILFUL_DEFAULT_CODES,
  TUEF_ASSET_CLASSIFICATION_CODES,
  TUEF_RESTRUCTURED_STATUS_LABELS,
  TUEF_RESTRUCTURED_WRITTEN_OFF_SETTLED_CODES,
  TUEF_SUIT_FILED_WILFUL_DEFAULT_LABELS,
} from './cibil-tuef.constants';
import {
  isCibilSentinelAmount,
  parseBureauReport,
  parseCibilDate,
  parsePayStatusToDpdDays,
  readSuitFiledWilfulDefaultCode,
  resolveBureauAsOfDate,
} from './cibil-bureau-rules.parser';
import {
  isCibilTradelineOpen,
  normalizeCibilAccountTypeSymbol,
  parseCibilTradeline,
} from './cibil-tradeline.parser';

export type CibilAssessmentInsights = {
  riskScore: number | null;
  noOfLoans: number;
  noOfCreditcards: number;
  noOfUnsecuredLoans: number;
  noOfSecuredLoans: number;
  noOfGoldLoans: number;
  sixMEnq: number;
  totalEnq: number;
  settledLoansCounts: number;
  totalOverdueAmounts: number;
  defaultLoans: string[];
  writeoffLoan: string[];
  settledLoan: string[];
  loanContainStatusSma: string[];
  loanContainStatusSub: string[];
  loanContainStatusDbt: string[];
  loanContainStatusLss: string[];
  dpd30Last3Months: string[];
  dpd60Last9Months: string[];
  dpd90Last12Months: string[];
  openLoanDpdLast6Months: string[];
  defaultsInLast18Months: string[];
  doubtfulInLast18Months: string[];
  restructuredLoans: string[];
  pwosTradelines: string[];
  missedPaymentsIn6m: string[];
  category: string | null;
};

export const CREDIT_CARD_ACCOUNT_TYPES = new Set(['10', '31', '35', '36']);
export const GOLD_LOAN_ACCOUNT_TYPE = '07';
const SETTLED_STATUS_CODES = new Set(['03', '09']);
const WRITEOFF_STATUS_CODES = new Set(['02', '06', '08']);
const PWOS_STATUS_CODES = new Set(['04']);
const SMA_CODES = new Set(['SMA', 'SMA0', 'SMA1', 'SMA2']);
const SUB_CODES = new Set([TUEF_ASSET_CLASSIFICATION_CODES.SUB]);
const DBT_CODES = new Set([TUEF_ASSET_CLASSIFICATION_CODES.DBT]);
const LSS_CODES = new Set([TUEF_ASSET_CLASSIFICATION_CODES.LSS, 'LOSS']);
const SIX_MONTH_DAYS = 183;
const EIGHTEEN_MONTHS = 18;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function readSymbol(node: unknown): string | null {
  const rec = asRecord(node);
  if (!rec) return null;
  const raw = rec.symbol ?? rec.Symbol;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function normalizeStatus(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase();
}

function normalizeTuefCode(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s.padStart(2, '0');
  return s.toUpperCase();
}

function monthsBetween(start: Date, end: Date): number {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
}

function isWithinLookbackMonths(eventDate: Date, asOf: Date, lookbackMonths: number): boolean {
  const months = monthsBetween(eventDate, asOf);
  return months >= 0 && months < lookbackMonths;
}

export function parseInrAmount(raw: unknown): number {
  if (isCibilSentinelAmount(raw)) return 0;
  const n = Number.parseInt(String(raw).replace(/,/g, '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function uniquePush(list: string[], value: string): void {
  const v = value.trim();
  if (!v) return;
  if (!list.includes(v)) list.push(v);
}

function readWrittenOffSettledCodes(lineRec: Record<string, unknown>): string[] {
  const codes = new Set<string>();
  const direct =
    lineRec.writtenOffSettledStatus ??
    lineRec.WrittenOffSettledStatus ??
    lineRec.writtenOffAndSettledStatus ??
    lineRec.WrittenOffAndSettledStatus;
  const fromDirect = normalizeTuefCode(direct);
  if (fromDirect) codes.add(fromDirect);

  const fromNode = normalizeTuefCode(readSymbol(lineRec.WrittenOffSettled));
  if (fromNode) codes.add(fromNode);

  const granted = asRecord(lineRec.GrantedTrade);
  if (granted) {
    const fromGranted =
      normalizeTuefCode(granted.writtenOffSettledStatus) ??
      normalizeTuefCode(granted.WrittenOffSettledStatus) ??
      normalizeTuefCode(readSymbol(granted.WrittenOffSettled));
    if (fromGranted) codes.add(fromGranted);
  }

  return [...codes];
}

function resolvePayStatusHistory(lineRec: Record<string, unknown>): Record<string, unknown> | null {
  const direct = asRecord(lineRec.PayStatusHistory);
  if (direct) return direct;
  const granted = asRecord(lineRec.GrantedTrade);
  return granted ? asRecord(granted.PayStatusHistory) : null;
}

function collectMonthlyPayStatuses(
  lineRec: Record<string, unknown>,
): Array<{ monthDate: Date; status: string; dpdDays: number | null }> {
  const payHistory = resolvePayStatusHistory(lineRec);
  if (!payHistory) return [];

  const rows: Array<{ monthDate: Date; status: string; dpdDays: number | null }> = [];

  for (const entry of asArray(payHistory.MonthlyPayStatus)) {
    const entryRec = asRecord(entry);
    if (!entryRec) continue;
    const monthDate = parseCibilDate(entryRec.date);
    if (!monthDate) continue;
    const status = String(entryRec.status ?? '').trim();
    rows.push({ monthDate, status, dpdDays: parsePayStatusToDpdDays(status) });
  }

  if (rows.length > 0 || typeof payHistory.status !== 'string') return rows;

  const statuses = String(payHistory.status)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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
    return monthDate ? [{ monthDate, status, dpdDays: parsePayStatusToDpdDays(status) }] : [];
  });
}

function collectClassificationCodes(lineRec: Record<string, unknown>): string[] {
  const codes = new Set<string>();
  const payStatus = readSymbol(lineRec.PayStatus);
  if (payStatus) codes.add(payStatus.toUpperCase());

  const granted = asRecord(lineRec.GrantedTrade);
  const worst = granted ? readSymbol(granted.WorstPayStatus) : null;
  if (worst) codes.add(worst.toUpperCase());

  const condition = readSymbol(lineRec.AccountCondition);
  if (condition) codes.add(condition.toUpperCase());

  for (const row of collectMonthlyPayStatuses(lineRec)) {
    const status = normalizeStatus(row.status);
    if (status) codes.add(status);
  }

  return [...codes];
}

function classificationHits(codes: string[], match: Set<string>): boolean {
  return codes.some((code) => match.has(code) || [...match].some((m) => code.startsWith(m)));
}

function emptyInsights(riskScore: number | null): CibilAssessmentInsights {
  return {
    riskScore,
    noOfLoans: 0,
    noOfCreditcards: 0,
    noOfUnsecuredLoans: 0,
    noOfSecuredLoans: 0,
    noOfGoldLoans: 0,
    sixMEnq: 0,
    totalEnq: 0,
    settledLoansCounts: 0,
    totalOverdueAmounts: 0,
    defaultLoans: [],
    writeoffLoan: [],
    settledLoan: [],
    loanContainStatusSma: [],
    loanContainStatusSub: [],
    loanContainStatusDbt: [],
    loanContainStatusLss: [],
    dpd30Last3Months: [],
    dpd60Last9Months: [],
    dpd90Last12Months: [],
    openLoanDpdLast6Months: [],
    defaultsInLast18Months: [],
    doubtfulInLast18Months: [],
    restructuredLoans: [],
    pwosTradelines: [],
    missedPaymentsIn6m: [],
    category: null,
  };
}

export function extractCibilAssessmentInsights(
  vendorBody: unknown,
  riskScore: number | null,
): CibilAssessmentInsights {
  const out = emptyInsights(riskScore);
  const parsed = parseBureauReport(vendorBody);
  const asOf = parsed.bureauAsOfDate ?? resolveBureauAsOfDate(vendorBody);

  out.totalEnq = parsed.enquiries.length;
  const sixMStart = new Date(asOf);
  sixMStart.setUTCDate(sixMStart.getUTCDate() - SIX_MONTH_DAYS);
  out.sixMEnq = parsed.enquiries.filter((inq) => inq.date >= sixMStart && inq.date <= asOf).length;

  for (const { lineRec, partitionSymbol, creditor } of parsed.tradelines) {
    const label = creditor || 'Account';
    const parsedLine = parseCibilTradeline(lineRec, partitionSymbol);
    const accountType = parsedLine?.accountTypeSymbol ?? normalizeCibilAccountTypeSymbol(partitionSymbol);
    const isOpen = parsedLine?.isOpen ?? isCibilTradelineOpen(lineRec);
    const isUnsecured = accountType != null && CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS.has(accountType);
    const woCodes = readWrittenOffSettledCodes(lineRec);
    const classifications = collectClassificationCodes(lineRec);
    const monthly = collectMonthlyPayStatuses(lineRec);
    const reportedAt = parseCibilDate(lineRec.dateReported) ?? parseCibilDate(lineRec.dateOpened);
    const granted = asRecord(lineRec.GrantedTrade);

    out.noOfLoans += 1;
    if (accountType && CREDIT_CARD_ACCOUNT_TYPES.has(accountType)) out.noOfCreditcards += 1;
    if (accountType === GOLD_LOAN_ACCOUNT_TYPE) out.noOfGoldLoans += 1;
    if (isUnsecured) out.noOfUnsecuredLoans += 1;
    else out.noOfSecuredLoans += 1;

    out.totalOverdueAmounts += parseInrAmount(granted?.amountPastDue ?? lineRec.amountPastDue);

    const suitCode = readSuitFiledWilfulDefaultCode(lineRec);
    if (suitCode && TUEF_ADVERSE_SUIT_FILED_WILFUL_DEFAULT_CODES.has(suitCode)) {
      uniquePush(out.defaultLoans, TUEF_SUIT_FILED_WILFUL_DEFAULT_LABELS[suitCode] ?? suitCode);
      if (!reportedAt || isWithinLookbackMonths(reportedAt, asOf, EIGHTEEN_MONTHS)) {
        uniquePush(out.defaultsInLast18Months, TUEF_SUIT_FILED_WILFUL_DEFAULT_LABELS[suitCode] ?? suitCode);
      }
    }

    const writeoffAmt = parseInrAmount(lineRec.writtenOffAmtTotal ?? lineRec.writtenOffPrincipal);
    if (writeoffAmt > 0 || woCodes.some((c) => WRITEOFF_STATUS_CODES.has(c))) {
      uniquePush(out.writeoffLoan, writeoffAmt > 0 ? String(writeoffAmt) : label);
    }

    const settlementAmt = parseInrAmount(lineRec.settlementAmount);
    const isSettled = settlementAmt > 0 || woCodes.some((c) => SETTLED_STATUS_CODES.has(c));
    if (isSettled) {
      out.settledLoansCounts += 1;
      uniquePush(out.settledLoan, settlementAmt > 0 ? String(settlementAmt) : label);
      if (!reportedAt || isWithinLookbackMonths(reportedAt, asOf, EIGHTEEN_MONTHS)) {
        uniquePush(out.defaultsInLast18Months, 'Settled');
      }
    }

    if (classificationHits(classifications, SMA_CODES)) {
      uniquePush(out.loanContainStatusSma, label);
    }
    if (classificationHits(classifications, SUB_CODES)) uniquePush(out.loanContainStatusSub, label);
    if (classificationHits(classifications, DBT_CODES)) uniquePush(out.loanContainStatusDbt, label);
    if (classificationHits(classifications, LSS_CODES)) uniquePush(out.loanContainStatusLss, label);

    const isPwos =
      woCodes.some((c) => PWOS_STATUS_CODES.has(c)) ||
      classifications.some((c) => c === 'PWOS' || c === 'POSTWO' || c === 'POSTWOS');
    if (isPwos) uniquePush(out.pwosTradelines, label);

    const restructureCode = woCodes.find((c) => TUEF_RESTRUCTURED_WRITTEN_OFF_SETTLED_CODES.has(c));
    if (restructureCode) {
      uniquePush(
        out.restructuredLoans,
        TUEF_RESTRUCTURED_STATUS_LABELS[restructureCode] ?? restructureCode,
      );
    }

    const hasDoubtfulClass = classificationHits(classifications, new Set([...SUB_CODES, ...DBT_CODES, ...LSS_CODES]));
    if (hasDoubtfulClass) {
      const recentDoubtful = monthly.some(
        (row) =>
          isWithinLookbackMonths(row.monthDate, asOf, EIGHTEEN_MONTHS) &&
          classificationHits([normalizeStatus(row.status)], new Set([...SUB_CODES, ...DBT_CODES, ...LSS_CODES])),
      );
      if (recentDoubtful || (!monthly.length && (!reportedAt || isWithinLookbackMonths(reportedAt, asOf, EIGHTEEN_MONTHS)))) {
        uniquePush(out.doubtfulInLast18Months, label);
      }
    }

    for (const row of monthly) {
      if (row.dpdDays == null || row.dpdDays <= 0) continue;
      if (isWithinLookbackMonths(row.monthDate, asOf, 3) && row.dpdDays >= 30) {
        uniquePush(out.dpd30Last3Months, label);
      }
      if (isWithinLookbackMonths(row.monthDate, asOf, 9) && row.dpdDays >= 60) {
        uniquePush(out.dpd60Last9Months, label);
      }
      if (isWithinLookbackMonths(row.monthDate, asOf, 12) && row.dpdDays >= 90) {
        uniquePush(out.dpd90Last12Months, label);
      }
      if (isOpen && isWithinLookbackMonths(row.monthDate, asOf, 6)) {
        uniquePush(out.openLoanDpdLast6Months, label);
      }
      if (isWithinLookbackMonths(row.monthDate, asOf, 6)) {
        uniquePush(out.missedPaymentsIn6m, label);
      }
    }
  }

  return out;
}
