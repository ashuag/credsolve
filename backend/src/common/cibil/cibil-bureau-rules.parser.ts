/**
 * Post-bureau eligibility rules over Tenacio / CIBIL soft-pull payloads.
 */
import {
  TUEF_MFI_ACCOUNT_TYPE_SYMBOLS,
  TUEF_NON_LOAN_ENQUIRY_PURPOSE_CODES,
  TUEF_RESTRUCTURED_STATUS_LABELS,
  TUEF_RESTRUCTURED_WRITTEN_OFF_SETTLED_CODES,
  TUEF_SMA_PWOS_ASSET_CLASSIFICATION_CODES,
} from './cibil-tuef.constants';
import {
  cibilAccountTypeDisplayLabel,
  extractTradelinesFromBureauVendorBody,
  isCibilTradelineOpen,
  isLoanRelatedAccountType,
  normalizeCibilAccountTypeSymbol,
  parseCibilTradeline,
} from './cibil-tradeline.parser';

/** Payment-history / asset-classification markers that fail "no DBT/LSS/SUB/settled" rules. */
const ADVERSE_PAY_STATUS_CODES = new Set([
  'SUB',
  'DBT',
  'LSS',
  'LOSS',
  'SMA',
  'SMA0',
  'SMA1',
  'SMA2',
  'PWOS',
  'SET',
  'SETTLED',
  'WOF',
  'WOFF',
  'WO',
  'WRITTEN',
  'WRITTENOFF',
  'RGM',
  'RCV',
  'DEV',
  'SPM',
]);

const NEUTRAL_PAY_STATUS_CODES = new Set(['0', '00', '000', 'STD', 'XXX', 'CLSD', 'CLOSED', '-1', '-2']);

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

  const isoLike = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoLike) {
    const d = new Date(`${isoLike[1]}-${isoLike[2]}-${isoLike[3]}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const compact = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) {
    const d = new Date(`${compact[1]}-${compact[2]}-${compact[3]}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthsBetween(start: Date, end: Date): number {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
}

function isWithinLookbackMonths(eventDate: Date, asOf: Date, lookbackMonths: number): boolean {
  return monthsBetween(eventDate, asOf) >= 0 && monthsBetween(eventDate, asOf) < lookbackMonths;
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

function tradelineHasRestructureSignal(lineRec: Record<string, unknown>): boolean {
  const statusCode = readWrittenOffSettledStatusCode(lineRec);
  if (statusCode && TUEF_RESTRUCTURED_WRITTEN_OFF_SETTLED_CODES.has(statusCode)) {
    return true;
  }

  const granted = asRecord(lineRec.GrantedTrade);
  if (granted) {
    const grantedCode =
      normalizeTuefStatusCode(granted.writtenOffSettledStatus) ??
      normalizeTuefStatusCode(granted.WrittenOffSettledStatus) ??
      normalizeTuefStatusCode(readSymbol(granted.WrittenOffSettled));
    if (grantedCode && TUEF_RESTRUCTURED_WRITTEN_OFF_SETTLED_CODES.has(grantedCode)) {
      return true;
    }
  }

  return false;
}

function isMfiAccountType(symbol: string | null): boolean {
  const norm = symbol ? normalizeCibilAccountTypeSymbol(symbol) : null;
  return norm != null && TUEF_MFI_ACCOUNT_TYPE_SYMBOLS.has(norm);
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

/**
 * Collects every adverse tradeline signal in the lookback window (LOS dry-run drill-down).
 */
export function auditNoAdverseTradelineInLookback(
  body: unknown,
  lookbackMonths: number,
  asOf: Date = new Date(),
): BureauAdverseTradelineCheck & { findings: BureauRuleFinding[] } {
  const findings: BureauRuleFinding[] = [];
  const tlr = readTrueLinkCreditReport(body);

  if (!tlr) {
    findings.push({
      title: 'No TrueLink credit report',
      detail: 'Could not read TrueLinkCreditReport from bureau payload; tradeline rules were skipped.',
    });
    return { passed: true, detail: null, findings };
  }

  const partitions = asArray(tlr.TradeLinePartition);
  for (const partition of partitions) {
    const partitionRec = asRecord(partition);
    if (!partitionRec) continue;

    const partitionSymbol =
      partitionRec.accountTypeSymbol != null
        ? String(partitionRec.accountTypeSymbol).trim()
        : null;

    for (const rawLine of asArray(partitionRec.Tradeline)) {
      const lineRec = asRecord(rawLine);
      if (!lineRec) continue;

      const parsed = parseCibilTradeline(rawLine, partitionSymbol);
      const creditor = String(lineRec.creditorName ?? 'account').trim() || 'account';

      if (
        !isCibilSentinelAmount(lineRec.writtenOffAmtTotal) ||
        !isCibilSentinelAmount(lineRec.writtenOffPrincipal) ||
        !isCibilSentinelAmount(lineRec.settlementAmount)
      ) {
        const reported = parseCibilDate(lineRec.dateReported);
        if (!reported || isWithinLookbackMonths(reported, asOf, lookbackMonths)) {
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

      const payHistory = resolvePayStatusHistory(lineRec);
      if (payHistory) {
        for (const entry of asArray(payHistory.MonthlyPayStatus)) {
          const entryRec = asRecord(entry);
          if (!entryRec) continue;
          const status = entryRec.status;
          if (!isAdversePayStatus(status)) continue;
          const monthDate = parseCibilDate(entryRec.date);
          if (monthDate && isWithinLookbackMonths(monthDate, asOf, lookbackMonths)) {
            findings.push({
              title: creditor,
              detail: `Adverse monthly payment status "${String(status)}".`,
              data: {
                source: 'MonthlyPayStatus',
                payStatus: String(status),
                month: formatCibilDateLabel(monthDate),
                lookbackMonths,
              },
            });
          }
        }
      }

      const granted = asRecord(lineRec.GrantedTrade);
      const worst = granted ? readSymbol(granted.WorstPayStatus) : null;
      if (worst && isAdversePayStatus(worst)) {
        const reported = parseCibilDate(lineRec.dateReported);
        if (!reported || isWithinLookbackMonths(reported, asOf, lookbackMonths)) {
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
      }

      if (parsed) {
        const accountCondition = readSymbol(lineRec.AccountCondition);
        if (accountCondition && isAdversePayStatus(accountCondition)) {
          findings.push({
            title: creditor,
            detail: `Adverse account condition "${accountCondition}".`,
            data: {
              source: 'AccountCondition',
              accountCondition,
              lookbackMonths,
            },
          });
        }
      }
    }
  }

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

/** Collect credit enquiries from TrueLink `InquiryPartition` (deduped). */
export function extractBureauInquiries(body: unknown): ParsedBureauInquiry[] {
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
    for (const partition of asArray(tlr.InquiryPartition)) {
      const partitionRec = asRecord(partition);
      const inquiry = partitionRec ? asRecord(partitionRec.Inquiry) : null;
      if (!inquiry) continue;
      const date = parseCibilDate(inquiry.inquiryDate);
      if (!date) continue;
      push({
        date,
        inquiryType: inquiry.inquiryType != null ? String(inquiry.inquiryType).trim() : null,
        controlNumber:
          inquiry.enqControlNum != null ? String(inquiry.enqControlNum).trim() : null,
        subscriberName:
          inquiry.subscriberName != null ? String(inquiry.subscriberName).trim() : null,
        amount: inquiry.amount != null ? String(inquiry.amount).trim() : null,
      });
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
  isLoanRelated: boolean;
  accountLabel: string;
};

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

function collectMonthlyDpdEntries(body: unknown): MonthlyDpdEntry[] {
  const entries: MonthlyDpdEntry[] = [];
  const tlr = readTrueLinkCreditReport(body);
  if (!tlr) return entries;

  for (const partition of asArray(tlr.TradeLinePartition)) {
    const partitionRec = asRecord(partition);
    if (!partitionRec) continue;

    const partitionSymbol = normalizeCibilAccountTypeSymbol(
      partitionRec.accountTypeSymbol != null
        ? String(partitionRec.accountTypeSymbol)
        : undefined,
    );

    for (const rawLine of asArray(partitionRec.Tradeline)) {
      const lineRec = asRecord(rawLine);
      if (!lineRec) continue;

      const accountLabel = String(lineRec.creditorName ?? 'account').trim() || 'account';
      const isOpen = isCibilTradelineOpen(lineRec);
      const isLoanRelated = isLoanRelatedAccountType(partitionSymbol);

      const payHistory = resolvePayStatusHistory(lineRec);
      if (payHistory) {
        let monthlyAdded = false;
        for (const entry of asArray(payHistory.MonthlyPayStatus)) {
          const entryRec = asRecord(entry);
          if (!entryRec) continue;
          const monthDate = parseCibilDate(entryRec.date);
          const dpdDays = parsePayStatusToDpdDays(entryRec.status);
          if (!monthDate || dpdDays == null) continue;
          entries.push({ monthDate, dpdDays, isOpen, isLoanRelated, accountLabel });
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
            entries.push({ monthDate, dpdDays, isOpen, isLoanRelated, accountLabel });
          }
        }
      }
    }
  }

  return entries;
}

/**
 * DPD windows from bureau payment history (all tradelines + open loan accounts).
 * Thresholds align with `open_dpd_months`, `dpd_30plus_months`, etc. in eligibility criteria.
 */
export function checkBureauDpdRules(
  body: unknown,
  thresholds: BureauDpdThresholds,
  asOf: Date = new Date(),
): BureauAdverseTradelineCheck {
  const entries = collectMonthlyDpdEntries(body);

  for (const entry of entries) {
    if (!isWithinLookbackMonths(entry.monthDate, asOf, thresholds.dpd90PlusMonths)) {
      continue;
    }
    if (entry.dpdDays >= 90) {
      return {
        passed: false,
        detail: `${entry.accountLabel}: 90+ DPD (${entry.dpdDays} days) reported within the last ${thresholds.dpd90PlusMonths} months.`,
      };
    }
  }

  for (const entry of entries) {
    if (!isWithinLookbackMonths(entry.monthDate, asOf, thresholds.dpd60PlusMonths)) {
      continue;
    }
    if (entry.dpdDays >= 60) {
      return {
        passed: false,
        detail: `${entry.accountLabel}: 60+ DPD (${entry.dpdDays} days) reported within the last ${thresholds.dpd60PlusMonths} months.`,
      };
    }
  }

  for (const entry of entries) {
    if (!isWithinLookbackMonths(entry.monthDate, asOf, thresholds.dpd30PlusMonths)) {
      continue;
    }
    if (entry.dpdDays >= 30) {
      return {
        passed: false,
        detail: `${entry.accountLabel}: 30+ DPD (${entry.dpdDays} days) reported within the last ${thresholds.dpd30PlusMonths} months.`,
      };
    }
  }

  for (const entry of entries) {
    if (!entry.isOpen || !entry.isLoanRelated) continue;
    if (!isWithinLookbackMonths(entry.monthDate, asOf, thresholds.openDpdMonths)) {
      continue;
    }
    if (entry.dpdDays > 0) {
      return {
        passed: false,
        detail: `${entry.accountLabel}: open loan account with DPD (${entry.dpdDays} days) in the last ${thresholds.openDpdMonths} months.`,
      };
    }
  }

  return { passed: true, detail: null };
}

export type BureauDpdRuleKey = 'open_dpd' | 'dpd_30plus' | 'dpd_60plus' | 'dpd_90plus';

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
  const entries = collectMonthlyDpdEntries(body);
  const failureFindings: Partial<Record<BureauDpdRuleKey, BureauRuleFinding[]>> = {};

  const pushFailure = (
    ruleKey: BureauDpdRuleKey,
    entry: MonthlyDpdEntry,
    minDpd: number,
    lookbackMonths: number,
  ) => {
    const list = failureFindings[ruleKey] ?? [];
    list.push({
      title: entry.accountLabel,
      detail: `${entry.dpdDays} DPD in month ${formatCibilDateLabel(entry.monthDate) ?? 'unknown'} (threshold ≥ ${minDpd} days).`,
      data: {
        account: entry.accountLabel,
        month: formatCibilDateLabel(entry.monthDate),
        dpdDays: entry.dpdDays,
        openAccount: entry.isOpen,
        loanRelated: entry.isLoanRelated,
        lookbackMonths,
        minDpdDays: minDpd,
      },
    });
    failureFindings[ruleKey] = list;
  };

  for (const entry of entries) {
    if (
      isWithinLookbackMonths(entry.monthDate, asOf, thresholds.dpd90PlusMonths) &&
      entry.dpdDays >= 90
    ) {
      pushFailure('dpd_90plus', entry, 90, thresholds.dpd90PlusMonths);
    }
  }

  for (const entry of entries) {
    if (
      isWithinLookbackMonths(entry.monthDate, asOf, thresholds.dpd60PlusMonths) &&
      entry.dpdDays >= 60
    ) {
      pushFailure('dpd_60plus', entry, 60, thresholds.dpd60PlusMonths);
    }
  }

  for (const entry of entries) {
    if (
      isWithinLookbackMonths(entry.monthDate, asOf, thresholds.dpd30PlusMonths) &&
      entry.dpdDays >= 30
    ) {
      pushFailure('dpd_30plus', entry, 30, thresholds.dpd30PlusMonths);
    }
  }

  for (const entry of entries) {
    if (!entry.isOpen || !entry.isLoanRelated) continue;
    if (
      isWithinLookbackMonths(entry.monthDate, asOf, thresholds.openDpdMonths) &&
      entry.dpdDays > 0
    ) {
      pushFailure('open_dpd', entry, 1, thresholds.openDpdMonths);
    }
  }

  const ruleKeys: BureauDpdRuleKey[] = ['dpd_90plus', 'dpd_60plus', 'dpd_30plus', 'open_dpd'];
  return ruleKeys.map((ruleKey) => {
    const findings = failureFindings[ruleKey] ?? [];
    if (!findings.length) {
      return { ruleKey, passed: true, detail: null, findings: [] };
    }
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
    findings.push({
      title: creditor,
      detail: statusLabel
        ? `Written-off / settled status: ${statusLabel} (TUEF code ${statusCode}).`
        : 'Tradeline flagged as restructured (TUEF Tag 33 — Written-off and Settled Status).',
      data: {
        accountType: partitionSymbol,
        writtenOffSettledStatus: statusCode,
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

/** No open microfinance (MFI) loan tradelines. */
export function auditNoActiveMfiLoans(body: unknown): BureauTradelineRuleCheck {
  const findings: BureauRuleFinding[] = [];

  walkTradelines(body, ({ lineRec, partitionSymbol, creditor }) => {
    if (!isCibilTradelineOpen(lineRec)) return;

    const industry = readSymbol(lineRec.IndustryCode);
    const mfiByType = isMfiAccountType(partitionSymbol);
    const mfiByIndustry = industry?.toUpperCase() === 'MFI';

    if (!mfiByType && !mfiByIndustry) return;

    findings.push({
      title: creditor,
      detail: 'Open microfinance (MFI) loan tradeline on bureau report.',
      data: {
        accountType: partitionSymbol,
        industryCode: industry,
        open: true,
        source: mfiByType ? 'accountType' : 'IndustryCode',
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

export type PostBreTradelineInspectionRow = {
  rowIndex: number;
  creditorName: string;
  accountNumber: string | null;
  accountTypeSymbol: string | null;
  accountTypeLabel: string;
  accountStatus: string;
  isOpen: boolean;
  isLoanRelated: boolean;
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

const TUEF_ENQUIRY_PURPOSE_LABELS: Record<string, string> = {
  '00': 'Other',
  '01': 'Auto loan',
  '02': 'Housing loan',
  '03': 'Property loan',
  '04': 'Personal loan',
  '05': 'Consumer loan',
  '06': 'Gold loan',
  '07': 'Education loan',
  '08': 'Loan to professional',
  '09': 'Credit card',
  '10': 'Lease',
  '11': 'Two-wheeler loan',
  '12': 'Non-funded credit facility',
  '13': 'Loan against bank deposits',
  '14': 'Fleet card',
  '15': 'Commercial vehicle loan',
  '16': 'Telco – wireless',
  '17': 'Telco – broadband',
  '18': 'Telco – landline',
  '31': 'Secured credit card',
  '32': 'Used car loan',
  '33': 'Construction equipment loan',
  '34': 'Tractor loan',
  '35': 'Corporate credit card',
  '36': 'Kisan credit card',
  '37': 'Loan on credit card',
  '38': 'PMJDY overdraft',
  '39': 'Mudra loan',
  '40': 'Microfinance – business',
  '41': 'Microfinance – personal',
  '42': 'Microfinance – housing',
  '43': 'Microfinance – other',
  '44': 'Pramaan (NREGA)',
  '45': 'P2P personal loan',
  '46': 'P2P auto loan',
  '47': 'P2P education loan',
  '50': 'Business loan – general',
  '51': 'Business loan – priority sector – small',
  '52': 'Business loan – priority sector – medium',
  '53': 'Business loan – priority sector – other',
  '54': 'Business non-funded credit facility – general',
  '55': 'Business non-funded credit facility – priority sector – small',
  '56': 'Business non-funded credit facility – priority sector – medium',
  '57': 'Business non-funded credit facility – priority sector – other',
  '58': 'Business loan against bank deposits',
  '59': 'Business loan – unsecured',
  '61': 'Business loan – unsecured',
  '80': 'Microfinance detailed report',
  '81': 'Summary report',
  '88': 'Locate plus for insurance',
  '90': 'Account review',
  '91': 'Retro enquiry',
  '92': 'Locate plus for non-credit',
  '97': 'Adviser liability',
  '98': 'Secured (generic)',
  '99': 'Unsecured (generic)',
};

function enquiryPurposeLabel(code: string | null): string {
  if (!code) return 'Unknown';
  const norm = code.trim().padStart(2, '0');
  return TUEF_ENQUIRY_PURPOSE_LABELS[norm] ?? `Purpose ${norm}`;
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
  isLoanRelated: boolean;
  isMfiAccount: boolean;
  activeRuleIds: Set<string>;
}): string[] {
  const rules: string[] = [];
  if (input.activeRuleIds.has('adverse_tradeline')) rules.push('adverse_tradeline');
  if (input.activeRuleIds.has('no_restructured_loans')) rules.push('no_restructured_loans');
  if (input.activeRuleIds.has('no_sma_pwos')) rules.push('no_sma_pwos');
  if (input.activeRuleIds.has('no_active_mfi') && input.isMfiAccount && input.isOpen) {
    rules.push('no_active_mfi');
  }
  if (input.isLoanRelated) {
    for (const id of input.activeRuleIds) {
      if (id.startsWith('dpd_')) rules.push(id);
    }
  }
  return rules;
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
    const isMfi =
      isMfiAccountType(partitionSymbol) || industry?.toUpperCase() === 'MFI';
    const isOpen = isCibilTradelineOpen(lineRec);
    const isLoanRelated = isLoanRelatedAccountType(partitionSymbol);
    const accountStatus = isOpen ? 'Open' : 'Closed';

    rows.push({
      rowIndex: rowIndex + 1,
      creditorName: creditor,
      accountNumber: accountNumber || null,
      accountTypeSymbol: partitionSymbol,
      accountTypeLabel: cibilAccountTypeDisplayLabel(partitionSymbol),
      accountStatus,
      isOpen,
      isLoanRelated,
      isMfiAccount: isMfi,
      restructureSignal: tradelineHasRestructureSignal(lineRec),
      smaPwosSignal: tradelineHasSmaPwosSignal(lineRec),
      evaluatedByRules: resolveTradelineEvaluatedRules({
        isOpen,
        isLoanRelated,
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
    const loanPurpose = isLoanEnquiryPurpose(inq.inquiryType);
    let excludeReason: string | null = null;
    if (!inRollingWindow) {
      excludeReason = `Outside ${windowDays}-day window`;
    } else if (!loanPurpose) {
      const norm = inq.inquiryType?.trim().padStart(2, '0') ?? '';
      excludeReason =
        norm === '10'
          ? 'Credit card enquiry (excluded from loan enquiry count)'
          : norm === '90' || norm === '91'
            ? 'Portfolio / retro enquiry (excluded)'
            : 'Non-loan enquiry purpose (excluded)';
    }

    return {
      inquiryDate: formatCibilDateLabel(inq.date) ?? inq.date.toISOString().slice(0, 10),
      inquiryType: inq.inquiryType,
      inquiryTypeLabel: enquiryPurposeLabel(inq.inquiryType),
      subscriberName: inq.subscriberName,
      controlNumber: inq.controlNumber,
      amount: inq.amount,
      inRollingWindow,
      countsTowardLoanEnquiryLimit: inRollingWindow && loanPurpose,
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
