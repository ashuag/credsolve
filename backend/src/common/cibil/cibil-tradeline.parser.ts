import {
  ACCOUNT_TYPE_LABELS,
  CIBIL_CREDIT_CARD_ACCOUNT_TYPE_SYMBOLS,
  CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS,
} from './cibil-tuef.constants';


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
  if (openClosed?.toUpperCase() === 'C') {
    return false;
  }

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


function accountTypeLabel(symbol: string | null): string {
  if (!symbol) return 'Account';
  return ACCOUNT_TYPE_LABELS[symbol] ?? `Type ${symbol}`;
}

/** Human-readable CIBIL account type (TUEF Appendix A) for LOS diagnostics. */
export function cibilAccountTypeDisplayLabel(symbol: string | null): string {
  return accountTypeLabel(symbol);
}

function parseTradelineDate(raw: unknown): Date | null {
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

function formatTradelineDateDisplay(raw: unknown): string | null {
  const d = parseTradelineDate(raw);
  if (!d) return null;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export type OpenUnsecuredTradelineRow = {
  creditorName: string;
  accountNumber: string;
  accountTypeSymbol: string | null;
  accountTypeLabel: string;
  dateOpened: string | null;
  dateClosed: string | null;
  isOpen: boolean;
  exposureInr: number;
  /** @deprecated Tier lookup uses the sum of all unsecured lines, not a single driver. */
  drivesTier: boolean;
};

export type OpenUnsecuredExposureBreakdown = {
  lines: OpenUnsecuredTradelineRow[];
  /** Sum of exposure across every unsecured tradeline (open + closed). Pre-approved tier input. */
  totalUnsecuredExposureInr: number;
  /** Sum of exposure across open unsecured tradelines (post-BRE MIN_UNSECURED_LOAN_AMOUNT). */
  totalOpenUnsecuredExposureInr: number;
  /** Largest single open unsecured exposure (inspection only). */
  maxOpenUnsecuredExposureInr: number;
};

const EMPTY_UNSECURED_EXPOSURE: OpenUnsecuredExposureBreakdown = {
  lines: [],
  totalUnsecuredExposureInr: 0,
  totalOpenUnsecuredExposureInr: 0,
  maxOpenUnsecuredExposureInr: 0,
};

/**
 * Lists every unsecured tradeline with exposure, plus total (all / open) and max open.
 */
export function computeOpenUnsecuredExposureBreakdown(body: unknown): OpenUnsecuredExposureBreakdown {
  const root = asRecord(body);
  if (!root) return EMPTY_UNSECURED_EXPOSURE;

  const data = asRecord(root.data);
  const cibilData = data ? asRecord(data.cibilData) : null;
  const gcr = cibilData ? asRecord(cibilData.GetCustomerAssetsResponse) : null;
  const success = gcr ? asRecord(gcr.GetCustomerAssetsSuccess) : null;
  if (!success) return EMPTY_UNSECURED_EXPOSURE;

  let asset = success.Asset;
  if (Array.isArray(asset)) asset = asset[0];
  const assetRec = asRecord(asset);
  const tlr = assetRec ? asRecord(assetRec.TrueLinkCreditReport) : null;
  if (!tlr) return EMPTY_UNSECURED_EXPOSURE;

  const rows: OpenUnsecuredTradelineRow[] = [];

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

      const parsed = parseCibilTradeline(rawLine, partitionSymbol);
      if (!parsed || !parsed.isUnsecured) continue;

      const accountNumber = String(lineRec.accountNumber ?? '').trim() || '-';
      const dateOpened = formatTradelineDateDisplay(lineRec.dateOpened ?? lineRec.DateOpened);
      const dateClosed = formatTradelineDateDisplay(lineRec.dateClosed ?? lineRec.DateClosed);
      rows.push({
        creditorName: String(lineRec.creditorName ?? 'Lender').trim() || 'Lender',
        accountNumber,
        accountTypeSymbol: parsed.accountTypeSymbol,
        accountTypeLabel: accountTypeLabel(parsed.accountTypeSymbol),
        dateOpened,
        dateClosed,
        isOpen: parsed.isOpen,
        exposureInr: parsed.exposureInr,
        drivesTier: false,
      });
    }
  }

  rows.sort((a, b) => b.exposureInr - a.exposureInr);

  let totalUnsecured = 0;
  let totalOpen = 0;
  let maxOpen = 0;
  for (const row of rows) {
    totalUnsecured += row.exposureInr;
    if (row.isOpen) {
      totalOpen += row.exposureInr;
      if (row.exposureInr > maxOpen) maxOpen = row.exposureInr;
    }
  }

  return {
    lines: rows,
    totalUnsecuredExposureInr: totalUnsecured,
    totalOpenUnsecuredExposureInr: totalOpen,
    maxOpenUnsecuredExposureInr: maxOpen,
  };
}

/**
 * Maximum exposure (INR) across open, unsecured tradelines.
 */
export function computeMaxOpenUnsecuredExposureInr(body: unknown): number {
  return computeOpenUnsecuredExposureBreakdown(body).maxOpenUnsecuredExposureInr;
}
