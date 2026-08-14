import {
  ACCOUNT_TYPE_LABELS,
  DWELLING_LABELS,
  PHONE_TYPE_LABELS,
} from './cibil-tuef.constants';
import { formatInrAmountForPdf } from '../pdf/pdf-safe-text.util';
import {
  formatSuitFiledWilfulDefaultLabel,
  parseCibilDate,
} from './cibil-bureau-rules.parser';
import {
  computeMaxOpenUnsecuredExposureInr,
  isCibilTradelineOpen,
  normalizeCibilAccountTypeSymbol,
  parseCibilTradeline,
} from './cibil-tradeline.parser';
import { parseTenacioBureauVendorBody } from '../vendor/tenacio-bureau-payload.mapper';
import { extractCibilAssessmentInsights, type CibilAssessmentInsights } from './cibil-assessment-insights';
import { response } from 'express';

export type CibilReportPaymentMonth = {
  year: number;
  month: number;
  status: string;
};

export type CibilReportAccountRow = {
  creditor: string;
  accountNumber: string;
  accountType: string;
  ownership: string;
  dateOpened: string | null;
  dateReported: string | null;
  dateClosed: string | null;
  dateLastPayment: string | null;
  paymentStartDate: string | null;
  paymentEndDate: string | null;
  sanctionedAmount: string;
  rateOfInterest: string;
  emiAmount: string;
  currentBalance: string;
  repaymentTenure: string;
  paymentFrequency: string;
  overdueAmount: string;
  cashLimit: string;
  highBalance: string;
  writtenOffTotal: string;
  writtenOffPrincipal: string;
  settlementAmount: string;
  collateralValue: string;
  collateralType: string;
  suitFiled: string;
  status: string;
  paymentHistory: CibilReportPaymentMonth[];
};

export type CibilReportInquiryRow = {
  date: string;
  member: string;
  purpose: string;
  amount: string;
};

export type CibilReportAddressRow = {
  category: string;
  address: string;
  pincode: string;
  dateReported: string | null;
};

export type CibilReportPhoneRow = {
  type: string;
  number: string;
};

export type CibilReportIdentifierRow = {
  type: string;
  number: string;
};

export type CibilReportScoreFactor = {
  code: string;
  text: string;
};

export type CibilReportAccountOverviewRow = {
  creditor: string;
  accountType: string;
  status: string;
  exposureInr: number;
  exposureLabel: string;
  isUnsecured: boolean;
};

export type CibilReportExposureInsight = {
  maxOpenUnsecuredExposureInr: number;
  drivingCreditor: string | null;
  drivingAccountType: string | null;
};

export type CibilReportPreApprovedInsight = {
  tierId: number | null;
  tierBandLabel: string | null;
  maxBulletLoan: number | null;
  preApprovedAmountInr: number | null;
  minLoanAmountInr: number;
  maxLoanAmountInr: number;
  detail: string;
};

export type CibilReportData = {
  generatedAt: string;
  bureauInquiryDate: string | null;
  controlNumber: string | null;
  consumerName: string;
  dateOfBirth: string | null;
  gender: string | null;
  pan: string | null;
  primaryMobile: string | null;
  emails: string[];
  cibilScore: number | null;
  scoreName: string | null;
  scoreRatingLabel: string | null;
  populationRank: string | null;
  employmentOccupation: string | null;
  employmentAccountType: string | null;
  employmentReportedDate: string | null;
  dateOfBirthDisplay: string | null;
  reportDateDisplay: string | null;
  vendorHtmlUrl: string | null;
  addresses: CibilReportAddressRow[];
  phones: CibilReportPhoneRow[];
  identifiers: CibilReportIdentifierRow[];
  accounts: CibilReportAccountRow[];
  inquiries: CibilReportInquiryRow[];
  creditSummary: {
    onTimePaymentHistory: string | null;
    creditCardUtilization: string | null;
    recentEnquiries: string | null;
    creditMix: string | null;
    oldestCreditAccountMonths: string | null;
  };
  scoreFactors: CibilReportScoreFactor[];
  accountOverview: CibilReportAccountOverviewRow[];
  exposureInsight: CibilReportExposureInsight;
  preApprovedInsight: CibilReportPreApprovedInsight | null;
  assessmentInsights: CibilAssessmentInsights;
};


const IDENTIFIER_LABELS: Record<string, string> = {
  TaxId: 'Income Tax ID Number (PAN)',
  VoterId: 'Voter ID',
  RationCardId: 'Ration card',
  SocialId: 'Social ID',
  PassportId: 'Passport',
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
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function formatDateLabel(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** DD/MM/YYYY as on myscore.cibil.com print view. */
export function formatIndianDate(d: Date | null): string | null {
  if (!d) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatControlNumberDisplay(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 5) return raw;
  return digits.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
}

function formatIsoDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function formatSentinelAmount(raw: unknown): string {
  if (raw == null || raw === '' || raw === '-1' || raw === -1 || raw === '-1.00') return '-';
  return formatInrAmountForPdf(raw);
}

function formatSentinelText(raw: unknown): string {
  if (raw == null || raw === '' || raw === '-1' || raw === -1) return '-';
  const s = String(raw).trim();
  return s || '-';
}

function formatCollateralType(raw: unknown): string {
  const rec = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const description = rec?.description ?? rec?.Description;
  if (description != null && String(description).trim()) return String(description).trim();
  return formatSentinelText(readSymbol(raw));
}

function maskAccountNumber(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '-';
  return s;
}

function accountTypeLabel(symbol: string | null): string {
  if (!symbol) return 'Account';
  const norm = normalizeCibilAccountTypeSymbol(symbol);
  return (norm && ACCOUNT_TYPE_LABELS[norm]) || `Type ${norm ?? symbol}`;
}

function inquiryPurposeLabel(code: unknown): string {
  const s = String(code ?? '').trim().padStart(2, '0');
  const labels: Record<string, string> = { '00': 'Other', '05': 'Personal loan', '06': 'Consumer loan', '10': 'Credit card' };
  return labels[s] ?? (s ? `Purpose ${s}` : '-');
}

function scoreRatingFromScore(score: number | null): string | null {
  if (score == null) return null;
  if (score === -1 || score === 0 || score === 1) return 'NEW TO CREDIT (NTC)';
  if (score >= 750) return 'LOW RISK';
  if (score >= 700) return 'MODERATE RISK';
  if (score >= 550) return 'HIGH RISK';
  return 'VERY HIGH RISK';
}

function formatExposureInr(n: number): string {
  return `Rs. ${Math.floor(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function extractScoreFactors(borrower: Record<string, unknown>): CibilReportScoreFactor[] {
  const creditScore = asRecord(borrower.CreditScore);
  if (!creditScore) return [];

  const factors: CibilReportScoreFactor[] = [];
  const seenCodes = new Set<string>();

  for (const factorNode of asArray(creditScore.CreditScoreFactor)) {
    const rec = asRecord(factorNode);
    if (!rec) continue;
    const code =
      readSymbol(rec.Factor) ??
      (rec.bureauCode != null ? String(rec.bureauCode).trim() : '') ??
      '';
    if (!code || code === '00' || seenCodes.has(code)) continue;

    const texts = asArray(rec.FactorText).map((t) => String(t).trim()).filter(Boolean);
    const line =
      texts.find((t) => t.toLowerCase().startsWith('factor:')) ??
      texts.find((t) => t.toLowerCase().startsWith('explain:')) ??
      texts[0];
    if (!line) continue;

    const text = line.replace(/^(factor|explain):\s*/i, '').trim();
    if (!text || text.toLowerCase().includes('no valid factors')) continue;

    seenCodes.add(code);
    factors.push({ code, text });
    if (factors.length >= 4) break;
  }

  return factors;
}

function extractIdentifiersFromBorrower(
  borrower: Record<string, unknown>,
): { identifiers: CibilReportIdentifierRow[]; pan: string | null } {
  const identifiers: CibilReportIdentifierRow[] = [];
  const seen = new Set<string>();
  let pan: string | null = null;

  const add = (type: string, number: string, identifierName?: string) => {
    const normalized = number.trim();
    if (!normalized) return;
    const key = `${type}:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);
    identifiers.push({ type, number: normalized });
    if (identifierName === 'TaxId') pan = normalized;
  };

  const partitionNodes = asArray(borrower.IdentifierPartition);
  const partitions: Record<string, unknown>[] = partitionNodes.length
    ? (partitionNodes.map((p) => asRecord(p)).filter(Boolean) as Record<string, unknown>[])
    : (() => {
        const single = asRecord(borrower.IdentifierPartition);
        return single ? [single] : [];
      })();

  for (const partition of partitions) {
    for (const idNode of asArray(partition.Identifier)) {
      const idRec = asRecord(idNode);
      const idInner = idRec ? asRecord(idRec.ID ?? idRec.id) : null;
      const numRaw = idInner?.Id ?? idInner?.ID ?? idInner?.id;
      if (numRaw == null) continue;
      const name = idInner?.IdentifierName != null ? String(idInner.IdentifierName) : 'ID';
      const label = IDENTIFIER_LABELS[name] ?? name;
      add(label, String(numRaw), name);
    }
  }

  const panFirst = [...identifiers].sort((a, b) => {
    const rank = (row: CibilReportIdentifierRow) => {
      if (row.type.includes('PAN')) return 0;
      if (row.type.includes('Passport')) return 1;
      if (row.type.includes('Voter')) return 2;
      if (row.type.includes('Social')) return 9;
      return 5;
    };
    return rank(a) - rank(b);
  });

  return { identifiers: panFirst, pan };
}

function parseInrFromDisplay(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function buildCreditSummary(
  summary: Record<string, unknown> | null,
  inquiries: CibilReportInquiryRow[],
  accounts: CibilReportAccountRow[],
): CibilReportData['creditSummary'] {
  const fromBureau = {
    onTimePaymentHistory:
      summary?.OnTimePaymentHistory != null ? `${String(summary.OnTimePaymentHistory)}%` : null,
    creditCardUtilization:
      summary?.CreditCardUtilization != null ? `${String(summary.CreditCardUtilization)}%` : null,
    recentEnquiries:
      summary?.Inquires != null
        ? String(summary.Inquires)
        : summary?.Inquiries != null
          ? String(summary.Inquiries)
          : null,
    creditMix: summary?.CreditMix != null ? String(summary.CreditMix) : null,
    oldestCreditAccountMonths:
      summary?.OldestCreditAccountPeriod != null
        ? String(summary.OldestCreditAccountPeriod)
        : null,
  };

  if (
    fromBureau.onTimePaymentHistory ||
    fromBureau.creditCardUtilization ||
    fromBureau.recentEnquiries
  ) {
    return fromBureau;
  }

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const recentEnquiryCount = inquiries.filter((inq) => {
    const parts = inq.date.split('/');
    if (parts.length !== 3) return false;
    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    return d >= twelveMonthsAgo;
  }).length;

  let limitTotal = 0;
  let balanceTotal = 0;
  for (const account of accounts) {
    if (account.status !== 'Open' || !account.accountType.toLowerCase().includes('credit card')) {
      continue;
    }
    const limit = parseInrFromDisplay(account.sanctionedAmount);
    const balance = parseInrFromDisplay(account.currentBalance);
    if (limit != null && limit > 0) limitTotal += limit;
    if (balance != null) balanceTotal += Math.max(0, balance);
  }

  const utilizationPct =
    limitTotal > 0 ? `${((balanceTotal / limitTotal) * 100).toFixed(1)}%` : null;

  return {
    ...fromBureau,
    creditCardUtilization: utilizationPct,
    recentEnquiries: String(recentEnquiryCount),
  };
}

function buildExposureInsight(
  overview: CibilReportAccountOverviewRow[],
  vendorBody: unknown,
): CibilReportExposureInsight {
  let maxExposure = computeMaxOpenUnsecuredExposureInr(vendorBody);
  let drivingCreditor: string | null = null;
  let drivingAccountType: string | null = null;

  for (const row of overview) {
    if (!row.isUnsecured || row.status !== 'Open') continue;
    if (row.exposureInr >= maxExposure) {
      maxExposure = row.exposureInr;
      drivingCreditor = row.creditor;
      drivingAccountType = row.accountType;
    }
  }

  return {
    maxOpenUnsecuredExposureInr: maxExposure,
    drivingCreditor,
    drivingAccountType,
  };
}

function readTrueLinkCreditReport(body: unknown): Record<string, unknown> | null {
  const root = asRecord(body);
  const data = root ? asRecord(root.data) : null;
  const cibilData = data ? asRecord(data.cibilData) : null;
  const gcr = cibilData ? asRecord(cibilData.GetCustomerAssetsResponse) : null;
  const success = gcr ? asRecord(gcr.GetCustomerAssetsSuccess) : null;
  if (!success) return null;
  let asset = success.Asset;
  if (Array.isArray(asset)) asset = asset[0];
  const assetRec = asRecord(asset);
  return assetRec ? asRecord(assetRec.TrueLinkCreditReport) : null;
}

function resolvePayStatusHistory(lineRec: Record<string, unknown>): Record<string, unknown> | null {
  const direct = asRecord(lineRec.PayStatusHistory);
  if (direct) return direct;
  const granted = asRecord(lineRec.GrantedTrade);
  return granted ? asRecord(granted.PayStatusHistory) : null;
}

function parsePayStatusEntryDate(entryRec: Record<string, unknown>): Date | null {
  return (
    parseCibilDate(entryRec.date) ??
    parseCibilDate(entryRec.Date) ??
    parseCibilDate(entryRec['@date'])
  );
}

function parsePayStatusEntryStatus(entryRec: Record<string, unknown>): string {
  const raw = entryRec.status ?? entryRec.Status ?? entryRec['@status'];
  return String(raw ?? 'XXX').trim() || 'XXX';
}

function extractPaymentHistory(lineRec: Record<string, unknown>): CibilReportPaymentMonth[] {
  const payHistory = resolvePayStatusHistory(lineRec);
  if (!payHistory) return [];

  const entries: Array<{ date: Date; status: string }> = [];

  for (const entry of asArray(payHistory.MonthlyPayStatus)) {
    const entryRec = asRecord(entry);
    if (!entryRec) continue;
    const date = parsePayStatusEntryDate(entryRec);
    if (!date) continue;
    entries.push({ date, status: parsePayStatusEntryStatus(entryRec) });
  }

  if (entries.length === 0 && typeof payHistory.status === 'string') {
    const statuses = String(payHistory.status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const end = parseCibilDate(payHistory.endDate ?? payHistory.EndDate);
    const start = parseCibilDate(payHistory.startDate ?? payHistory.StartDate);
    for (let i = 0; i < statuses.length; i++) {
      let monthDate: Date | null = null;
      if (end) {
        monthDate = new Date(end);
        monthDate.setUTCMonth(monthDate.getUTCMonth() - (statuses.length - 1 - i));
      } else if (start) {
        monthDate = new Date(start);
        monthDate.setUTCMonth(monthDate.getUTCMonth() + i);
      }
      if (!monthDate) continue;
      entries.push({ date: monthDate, status: statuses[i] || 'XXX' });
    }
  }

  entries.sort((a, b) => b.date.getTime() - a.date.getTime());

  return entries.slice(0, 48).map((entry) => ({
    year: entry.date.getUTCFullYear(),
    month: entry.date.getUTCMonth() + 1,
    status: entry.status,
  }));
}

const EMPLOYMENT_ACCOUNT_LABELS: Record<string, string> = {
  '05': 'Personal loan',
  '06': 'Consumer loan',
  '10': 'Credit card',
};

/**
 * Build a CIBIL TransUnion-style consumer report from TrueLink JSON only.
 */
export function extractCibilReportData(vendorBody: unknown): CibilReportData {
  const parsed = parseTenacioBureauVendorBody(vendorBody);
  const tlr = readTrueLinkCreditReport(vendorBody);
  const borrower = tlr ? asRecord(tlr.Borrower) : null;

  let consumerName = 'Consumer';
  let dateOfBirth: string | null = null;
  let gender: string | null = null;
  let pan: string | null = null;
  let scoreName: string | null = null;
  let populationRank: string | null = null;
  let bureauInquiryDate: string | null = null;
  let controlNumber: string | null = null;
  let employmentOccupation: string | null = null;
  let employmentAccountType: string | null = null;
  let employmentReportedDate: string | null = null;
  let dateOfBirthIso: string | null = null;

  const emails: string[] = [];
  const addresses: CibilReportAddressRow[] = [];
  const phones: CibilReportPhoneRow[] = [];
  let identifiers: CibilReportIdentifierRow[] = [];
  let scoreFactors: CibilReportScoreFactor[] = [];

  if (tlr?.ReferenceKey != null) {
    controlNumber = String(tlr.ReferenceKey).trim();
  }

  if (borrower) {
    const nameRec = asRecord(borrower.BorrowerName);
    const nameInner = nameRec ? asRecord(nameRec.Name) : null;
    if (nameInner?.Forename) consumerName = String(nameInner.Forename).trim();

    const birth = asRecord(borrower.Birth);
    if (birth?.date) {
      const dob = parseCibilDate(birth.date);
      dateOfBirthIso = formatIsoDate(dob);
      dateOfBirth = dateOfBirthIso;
    }
    if (borrower.Gender) {
      const g = String(borrower.Gender).trim();
      gender = g === '1' ? 'Male' : g === '2' ? 'Female' : g;
    }

    scoreFactors = extractScoreFactors(borrower);
    const idBundle = extractIdentifiersFromBorrower(borrower);
    identifiers = idBundle.identifiers;
    if (idBundle.pan) pan = idBundle.pan;

    const creditScore = asRecord(borrower.CreditScore);
    if (creditScore?.scoreName) scoreName = String(creditScore.scoreName).trim();
    if (creditScore?.populationRank != null) {
      populationRank = String(creditScore.populationRank).trim();
    }

    for (const emailNode of asArray(borrower.EmailAddress)) {
      const rec = asRecord(emailNode);
      const email = rec?.Email != null ? String(rec.Email).trim() : '';
      if (email && !emails.includes(email)) emails.push(email);
    }

    for (const addrNode of asArray(borrower.BorrowerAddress)) {
      const addrRec = asRecord(addrNode);
      if (!addrRec) continue;
      const dwelling = readSymbol(addrRec.Dwelling);
      const creditAddr = asRecord(addrRec.CreditAddress);
      const street = creditAddr?.StreetAddress != null ? String(creditAddr.StreetAddress).trim() : '';
      const pin = creditAddr?.PostalCode != null ? String(creditAddr.PostalCode).trim() : '';
      if (!street) continue;
      addresses.push({
        category: (dwelling && DWELLING_LABELS[dwelling]) || 'Address',
        address: street,
        pincode: pin,
        dateReported: formatIndianDate(parseCibilDate(addrRec.dateReported)),
      });
    }

    for (const phoneNode of asArray(borrower.BorrowerTelephone)) {
      const phoneRec = asRecord(phoneNode);
      const numberRec = phoneRec ? asRecord(phoneRec.PhoneNumber) : null;
      const number = numberRec?.Number != null ? String(numberRec.Number).trim() : '';
      if (!number) continue;
      const typeSym = readSymbol(phoneRec?.PhoneType);
      phones.push({
        type: (typeSym && PHONE_TYPE_LABELS[typeSym]) || 'Phone',
        number,
      });
    }

    const employer = asRecord(borrower.Employer);
    if (employer) {
      const occ = asRecord(employer.OccupationCode);
      employmentOccupation =
        occ?.description != null
          ? String(occ.description).trim()
          : readSymbol(employer.OccupationCode) ?? '-';
      const empAcct = employer.account != null ? String(employer.account).trim().padStart(2, '0') : '';
      employmentAccountType = EMPLOYMENT_ACCOUNT_LABELS[empAcct] ?? (empAcct ? `Type ${empAcct}` : '-');
      employmentReportedDate = formatIndianDate(parseCibilDate(employer.dateReported));
    }
  }

  const sources = tlr ? asRecord(tlr.Sources) : null;
  const source = sources ? asRecord(sources.Source) : null;
  const inquiryDateParsed = source?.InquiryDate ? parseCibilDate(source.InquiryDate) : null;
  if (inquiryDateParsed) {
    bureauInquiryDate = formatDateLabel(inquiryDateParsed);
  }
  const reportDateDisplay = formatIndianDate(inquiryDateParsed ?? new Date());
  const dateOfBirthDisplay = dateOfBirthIso ? formatIndianDate(parseCibilDate(dateOfBirthIso)) : null;

  const primaryMobile =
    phones.find((p) => p.type.toLowerCase().includes('mobile'))?.number ?? phones[0]?.number ?? null;

  const accounts: CibilReportAccountRow[] = [];
  const accountOverview: CibilReportAccountOverviewRow[] = [];
  if (tlr) {
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

        const granted = asRecord(lineRec.GrantedTrade);
        const isOpen = isCibilTradelineOpen(lineRec);
        const payHistory = resolvePayStatusHistory(lineRec);
        const parsedLine = parseCibilTradeline(rawLine, partitionSymbol);
        const creditor = String(lineRec.creditorName ?? 'Lender').trim() || 'Lender';
        const acctType = accountTypeLabel(partitionSymbol);

        if (parsedLine) {
          accountOverview.push({
            creditor,
            accountType: acctType,
            status: parsedLine.isOpen ? 'Open' : 'Closed',
            exposureInr: parsedLine.exposureInr,
            exposureLabel: formatExposureInr(parsedLine.exposureInr),
            isUnsecured: parsedLine.isUnsecured,
          });
        }

        accounts.push({
          creditor,
          accountNumber: maskAccountNumber(lineRec.accountNumber),
          accountType: acctType,
          ownership: readSymbol(lineRec.AccountDesignator) === '1' ? 'Individual' : 'Joint / Other',
          dateOpened: formatIndianDate(parseCibilDate(lineRec.dateOpened)),
          dateReported: formatIndianDate(parseCibilDate(lineRec.dateReported)),
          dateClosed: formatIndianDate(parseCibilDate(lineRec.dateClosed)),
          dateLastPayment: formatIndianDate(
            parseCibilDate(granted?.dateLastPayment ?? lineRec.dateAccountStatus),
          ),
          paymentStartDate: formatIndianDate(
            parseCibilDate(payHistory?.startDate ?? payHistory?.StartDate),
          ),
          paymentEndDate: formatIndianDate(
            parseCibilDate(payHistory?.endDate ?? payHistory?.EndDate),
          ),
          sanctionedAmount: formatSentinelAmount(granted?.CreditLimit ?? lineRec.highBalance),
          rateOfInterest: formatSentinelText(granted?.interestRate),
          emiAmount: formatSentinelAmount(granted?.EMIAmount),
          currentBalance: formatSentinelAmount(lineRec.currentBalance),
          repaymentTenure: formatSentinelText(granted?.termMonths),
          paymentFrequency: formatSentinelText(readSymbol(granted?.PaymentFrequency)),
          overdueAmount: formatSentinelAmount(granted?.amountPastDue),
          cashLimit: formatSentinelAmount(granted?.CashLimit),
          highBalance: formatSentinelAmount(lineRec.highBalance),
          writtenOffTotal: formatSentinelAmount(lineRec.writtenOffAmtTotal),
          writtenOffPrincipal: formatSentinelAmount(lineRec.writtenOffPrincipal),
          settlementAmount: formatSentinelAmount(lineRec.settlementAmount),
          collateralValue: formatSentinelAmount(granted?.collateral),
          collateralType: formatCollateralType(granted?.CollateralType),
          suitFiled: formatSuitFiledWilfulDefaultLabel(lineRec),
          status: isOpen ? 'Open' : 'Closed',
          paymentHistory: extractPaymentHistory(lineRec),
        });
      }
    }
  }

  const inquiries: CibilReportInquiryRow[] = [];
  if (tlr) {
    for (const partition of asArray(tlr.InquiryPartition)) {
      const partitionRec = asRecord(partition);
      const inquiry = partitionRec ? asRecord(partitionRec.Inquiry) : null;
      if (!inquiry) continue;
      const date = parseCibilDate(inquiry.inquiryDate);
      if (!date) continue;
      inquiries.push({
        date: formatIndianDate(date) ?? '-',
        member: String(inquiry.subscriberName ?? 'Enquirer').trim() || 'Enquirer',
        purpose: inquiryPurposeLabel(inquiry.inquiryType),
        amount: formatInrAmountForPdf(inquiry.amount),
      });
    }
  }
  inquiries.sort((a, b) => (a.date < b.date ? 1 : -1));

  const summary = tlr ? asRecord(tlr.CreditSummaryData) : null;
  const exposureInsight = buildExposureInsight(accountOverview, vendorBody);
  const creditSummary = buildCreditSummary(
    summary,
    inquiries,
    accounts,
  );

  return {
    generatedAt: new Date().toISOString(),
    bureauInquiryDate,
    controlNumber,
    consumerName,
    dateOfBirth: dateOfBirthIso,
    dateOfBirthDisplay,
    reportDateDisplay,
    gender,
    pan,
    primaryMobile,
    emails,
    cibilScore: parsed.bureauScore,
    scoreName,
    scoreRatingLabel: scoreRatingFromScore(parsed.bureauScore),
    populationRank,
    employmentOccupation,
    employmentAccountType,
    employmentReportedDate,
    vendorHtmlUrl: parsed.htmlUrl,
    addresses,
    phones,
    identifiers,
    accounts,
    inquiries,
    creditSummary,
    scoreFactors,
    accountOverview,
    exposureInsight,
    preApprovedInsight: null,
    assessmentInsights: extractCibilAssessmentInsights(vendorBody, parsed.bureauScore),
  };
}
