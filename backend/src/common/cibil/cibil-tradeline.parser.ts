import {
  CIBIL_CREDIT_CARD_ACCOUNT_TYPE_SYMBOLS,
  CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS,
} from './cibil-account-type.constants';

/** Non-loan tradelines excluded from "open loan DPD" checks (cards, telco). */
const NON_LOAN_ACCOUNT_TYPE_SYMBOLS = new Set(['10', '18', '19', '20']);

/** Loan / overdraft tradelines only (excludes credit card and telco). */
export function isLoanRelatedAccountType(accountTypeSymbol: string | null): boolean {
  if (!accountTypeSymbol) return true;
  return !NON_LOAN_ACCOUNT_TYPE_SYMBOLS.has(accountTypeSymbol);
}

export type ParsedCibilTradeline = {
  accountTypeSymbol: string | null;
  isUnsecured: boolean;
  isOpen: boolean;
  exposureInr: number;
};

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
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

/** Normalize CIBIL numeric account type codes to two digits (e.g. `5` → `05`). */
export function normalizeCibilAccountTypeSymbol(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) ? String(n).padStart(2, '0') : trimmed;
  }
  return trimmed.toUpperCase();
}

function parseInrAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s || s === '-1' || s === '-1.00') return null;
  const n = Number.parseInt(s.replace(/,/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function resolveAccountTypeSymbol(
  tradeline: Record<string, unknown>,
  partitionAccountTypeSymbol?: string | null,
): string | null {
  const direct =
    tradeline.accountTypeSymbol ??
    tradeline.AccountTypeSymbol ??
    readSymbol(tradeline.AccountType);
  const granted = asRecord(tradeline.GrantedTrade);
  const fromGranted =
    readSymbol(granted?.AccountType) ?? readSymbol(granted?.CreditType);
  const fromTradeline =
    direct != null ? String(direct) : fromGranted;
  return normalizeCibilAccountTypeSymbol(partitionAccountTypeSymbol ?? fromTradeline);
}

/** Open when `dateClosed` is absent/blank; optional OpenClosed symbol `C` means closed. */
export function isCibilTradelineOpen(tradeline: Record<string, unknown>): boolean {
  const dateClosed = tradeline.dateClosed ?? tradeline.DateClosed;
  if (dateClosed != null && String(dateClosed).trim() !== '') {
    return false;
  }
  const openClosed = readSymbol(tradeline.OpenClosed);
  if (openClosed?.toUpperCase() === 'C') return false;
  return true;
}

export function getTradelineExposureInr(
  tradeline: Record<string, unknown>,
  accountTypeSymbol: string | null,
): number {
  const granted = asRecord(tradeline.GrantedTrade);
  const isCreditCard =
    accountTypeSymbol != null && CIBIL_CREDIT_CARD_ACCOUNT_TYPE_SYMBOLS.has(accountTypeSymbol);

  if (isCreditCard && granted) {
    const limit = parseInrAmount(granted.CreditLimit);
    if (limit != null && limit > 0) return limit;
  }

  const high = parseInrAmount(tradeline.highBalance ?? tradeline.HighBalance);
  if (high != null && high > 0) return high;

  const current = parseInrAmount(tradeline.currentBalance ?? tradeline.CurrentBalance);
  if (current != null && current > 0) return current;

  if (granted) {
    const limit = parseInrAmount(granted.CreditLimit);
    if (limit != null && limit > 0) return limit;
  }

  return 0;
}

export function parseCibilTradeline(
  raw: unknown,
  partitionAccountTypeSymbol?: string | null,
): ParsedCibilTradeline | null {
  const tradeline = asRecord(raw);
  if (!tradeline) return null;

  const accountTypeSymbol = resolveAccountTypeSymbol(tradeline, partitionAccountTypeSymbol);
  const isUnsecured =
    accountTypeSymbol != null && CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS.has(accountTypeSymbol);
  const isOpen = isCibilTradelineOpen(tradeline);
  const exposureInr = getTradelineExposureInr(tradeline, accountTypeSymbol);

  return { accountTypeSymbol, isUnsecured, isOpen, exposureInr };
}

/** Walk `TrueLinkCreditReport.TradeLinePartition[].Tradeline`. */
export function extractTradelinesFromBureauVendorBody(body: unknown): ParsedCibilTradeline[] {
  const root = asRecord(body);
  if (!root) return [];

  const data = asRecord(root.data);
  const cibilData = data ? asRecord(data.cibilData) : null;
  const gcr = cibilData ? asRecord(cibilData.GetCustomerAssetsResponse) : null;
  const success = gcr ? asRecord(gcr.GetCustomerAssetsSuccess) : null;
  if (!success) return [];

  let asset = success.Asset;
  if (Array.isArray(asset)) asset = asset[0];
  const assetRec = asRecord(asset);
  const tlr = assetRec ? asRecord(assetRec.TrueLinkCreditReport) : null;
  if (!tlr) return [];

  const partitions = asArray(tlr.TradeLinePartition);
  const parsed: ParsedCibilTradeline[] = [];

  for (const partition of partitions) {
    const partitionRec = asRecord(partition);
    if (!partitionRec) continue;
    const partitionSymbol = normalizeCibilAccountTypeSymbol(
      partitionRec.accountTypeSymbol != null
        ? String(partitionRec.accountTypeSymbol)
        : undefined,
    );
    for (const rawLine of asArray(partitionRec.Tradeline)) {
      const line = parseCibilTradeline(rawLine, partitionSymbol);
      if (line) parsed.push(line);
    }
  }

  return parsed;
}

/**
 * Maximum exposure (INR) across open, unsecured tradelines.
 * Used to select a row from `credit_limit_tier` (`min_unsecured_loan` … `max_unsecured_loan`).
 */
export function computeMaxOpenUnsecuredExposureInr(body: unknown): number {
  const lines = extractTradelinesFromBureauVendorBody(body);
  let max = 0;
  for (const line of lines) {
    if (!line.isUnsecured || !line.isOpen) continue;
    if (line.exposureInr > max) max = line.exposureInr;
  }
  return max;
}
