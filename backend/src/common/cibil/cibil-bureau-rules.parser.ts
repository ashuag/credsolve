/**
 * Post-bureau eligibility rules over Tenacio / CIBIL soft-pull payloads.
 */
import {
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

function readOriginalDataAccounts(body: unknown): Record<string, unknown>[] {
  const tlr = readTrueLinkCreditReport(body);
  if (!tlr) return [];
  const sources = asRecord(tlr.Sources);
  const source = sources ? asRecord(sources.Source) : null;
  const original = source?.OriginalData;
  if (typeof original !== 'string' || !original.trim()) return [];

  try {
    const decoded = JSON.parse(Buffer.from(original, 'base64').toString('utf8')) as unknown;
    const root = asRecord(decoded);
    const response = root ? asRecord(root.ICRS_SubjectInquiryByTUEF_Response) : null;
    const subject = response?.subject;
    const first = Array.isArray(subject) ? subject[0] : subject;
    const subjectRec = asRecord(first);
    return asArray(subjectRec?.account).map((a) => asRecord(a)).filter((a): a is Record<string, unknown> => a != null);
  } catch {
    return [];
  }
}

export type BureauAdverseTradelineCheck = {
  passed: boolean;
  /** Human-readable detail when `passed` is false. */
  detail: string | null;
};

/**
 * No doubtful / loss / written-off / settled classification in the last `lookbackMonths`,
 * and tradeline write-off / settlement amount fields remain CIBIL sentinel (`-1`).
 */
export function checkNoAdverseTradelineInLookback(
  body: unknown,
  lookbackMonths: number,
  asOf: Date = new Date(),
): BureauAdverseTradelineCheck {
  const tlr = readTrueLinkCreditReport(body);
  if (!tlr) {
    return { passed: true, detail: null };
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
          return {
            passed: false,
            detail: `${creditor}: write-off or settlement amount reported on tradeline (expected -1).`,
          };
        }
      }

      const payHistory = asRecord(lineRec.PayStatusHistory);
      if (payHistory) {
        for (const entry of asArray(payHistory.MonthlyPayStatus)) {
          const entryRec = asRecord(entry);
          if (!entryRec) continue;
          const status = entryRec.status;
          if (!isAdversePayStatus(status)) continue;
          const monthDate = parseCibilDate(entryRec.date);
          if (monthDate && isWithinLookbackMonths(monthDate, asOf, lookbackMonths)) {
            return {
              passed: false,
              detail: `${creditor}: adverse payment status "${String(status)}" in the last ${lookbackMonths} months.`,
            };
          }
        }
      }

      const granted = asRecord(lineRec.GrantedTrade);
      const worst = granted ? readSymbol(granted.WorstPayStatus) : null;
      if (worst && isAdversePayStatus(worst)) {
        const reported = parseCibilDate(lineRec.dateReported);
        if (!reported || isWithinLookbackMonths(reported, asOf, lookbackMonths)) {
          return {
            passed: false,
            detail: `${creditor}: worst pay status "${worst}" on tradeline.`,
          };
        }
      }

      if (parsed) {
        const accountCondition = readSymbol(lineRec.AccountCondition);
        if (accountCondition && isAdversePayStatus(accountCondition)) {
          return {
            passed: false,
            detail: `${creditor}: adverse account condition "${accountCondition}".`,
          };
        }
      }
    }
  }

  for (const account of readOriginalDataAccounts(body)) {
    const member = String(account.memberShortName ?? 'account').trim() || 'account';
    if (
      !isCibilSentinelAmount(account.writtenOffAmtTotal) ||
      !isCibilSentinelAmount(account.writtenOffPrincipal) ||
      !isCibilSentinelAmount(account.settlementAmount)
    ) {
      const reported = parseCibilDate(account.reportedDate);
      if (!reported || isWithinLookbackMonths(reported, asOf, lookbackMonths)) {
        return {
          passed: false,
          detail: `${member}: write-off or settlement in bureau account snapshot (expected -1).`,
        };
      }
    }

    const history = account.paymentHistory;
    if (Array.isArray(history)) {
      const start = parseCibilDate(account.paymentHistStartDate);
      for (let i = 0; i < history.length; i++) {
        const status = history[i];
        if (!isAdversePayStatus(status)) continue;
        let monthDate: Date | null = null;
        if (start) {
          monthDate = new Date(start);
          monthDate.setUTCMonth(monthDate.getUTCMonth() + i);
        }
        if (!monthDate || isWithinLookbackMonths(monthDate, asOf, lookbackMonths)) {
          return {
            passed: false,
            detail: `${member}: adverse payment history "${String(status)}" in the last ${lookbackMonths} months.`,
          };
        }
      }
    }
  }

  return { passed: true, detail: null };
}

export type ParsedBureauInquiry = {
  date: Date;
  inquiryType: string | null;
  controlNumber: string | null;
};

/** Collect credit inquiries from TrueLink and embedded OriginalData (deduped). */
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
      });
    }
  }

  try {
    const tlr2 = readTrueLinkCreditReport(body);
    const sources = tlr2 ? asRecord(tlr2.Sources) : null;
    const source = sources ? asRecord(sources.Source) : null;
    const original = source?.OriginalData;
    if (typeof original === 'string' && original.trim()) {
      const decoded = JSON.parse(Buffer.from(original, 'base64').toString('utf8')) as unknown;
      const root = asRecord(decoded);
      const response = root ? asRecord(root.ICRS_SubjectInquiryByTUEF_Response) : null;
      const subject = response?.subject;
      const first = Array.isArray(subject) ? subject[0] : subject;
      const subjectRec = asRecord(first);
      for (const raw of asArray(subjectRec?.inquiry)) {
        const inq = asRecord(raw);
        if (!inq) continue;
        const date = parseCibilDate(inq.dateOfInquiry);
        if (!date) continue;
        push({
          date,
          inquiryType: inq.inquiryPurpose != null ? String(inq.inquiryPurpose).trim() : null,
          controlNumber:
            inq.enqControlNum != null ? String(inq.enqControlNum).trim() : null,
        });
      }
    }
  } catch {
    // ignore malformed OriginalData
  }

  return out;
}

/** Count credit/loan enquiries in the last `windowDays` (default 30). */
export function countBureauEnquiriesInLastDays(
  body: unknown,
  windowDays: number,
  asOf: Date = new Date(),
): number {
  const windowStart = new Date(asOf);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);

  return extractBureauInquiries(body).filter((inq) => inq.date >= windowStart && inq.date <= asOf)
    .length;
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

      const payHistory = asRecord(lineRec.PayStatusHistory);
      if (payHistory) {
        for (const entry of asArray(payHistory.MonthlyPayStatus)) {
          const entryRec = asRecord(entry);
          if (!entryRec) continue;
          const monthDate = parseCibilDate(entryRec.date);
          const dpdDays = parsePayStatusToDpdDays(entryRec.status);
          if (!monthDate || dpdDays == null) continue;
          entries.push({ monthDate, dpdDays, isOpen, isLoanRelated, accountLabel });
        }
      }
    }
  }

  for (const account of readOriginalDataAccounts(body)) {
    const accountLabel = String(account.memberShortName ?? 'account').trim() || 'account';
    const accountType = normalizeCibilAccountTypeSymbol(
      account.accountType != null ? String(account.accountType) : null,
    );
    const isLoanRelated = isLoanRelatedAccountType(accountType);
    const isOpen = !account.dateClosed || !String(account.dateClosed).trim();

    const history = account.paymentHistory;
    if (!Array.isArray(history)) continue;

    const end = parseCibilDate(account.paymentHistEndDate);
    const start = parseCibilDate(account.paymentHistStartDate);
    for (let i = 0; i < history.length; i++) {
      const dpdDays = parsePayStatusToDpdDays(history[i]);
      if (dpdDays == null) continue;

      let monthDate: Date | null = null;
      if (end) {
        monthDate = new Date(end);
        monthDate.setUTCMonth(monthDate.getUTCMonth() - (history.length - 1 - i));
      } else if (start) {
        monthDate = new Date(start);
        monthDate.setUTCMonth(monthDate.getUTCMonth() + i);
      }
      if (!monthDate) continue;

      entries.push({ monthDate, dpdDays, isOpen, isLoanRelated, accountLabel });
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
