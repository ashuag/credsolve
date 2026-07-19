/**
 * Surepass CIBIL → Tenacio envelope wrapper.
 *
 * Surepass (`POST /api/v1/credit-report-cibil/fetch-report`) returns a flat
 * `data.credit_report[]` payload. All downstream consumers — post-BRE rules
 * (`cibil-bureau-rules.parser`), tradeline exposure (`cibil-tradeline.parser`),
 * the LOS report PDF (`cibil-report-data.extractor`) and score parsing
 * (`tenacio-bureau-payload.mapper`) — read the Tenacio / TrueLink shape:
 *
 *   { status, serviceStatusCode, requestId,
 *     data.cibilData.GetCustomerAssetsResponse.GetCustomerAssetsSuccess
 *       .Asset.TrueLinkCreditReport.{Borrower, TradeLinePartition, InquiryPartition, …} }
 *
 * This mapper re-keys the Surepass payload into that shape so BRE rules and
 * the report renderer are untouched when the vendor is switched.
 */
import { ACCOUNT_TYPE_LABELS } from '../../cibil/cibil-tuef.constants';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asArray(v: unknown): unknown[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/** Blank / `-1` / `NA` sentinels → null (kept out of the mapped tradeline). */
function amountOrNull(v: unknown): string | null {
  const s = str(v);
  if (!s || s === '-1' || s === '-1.00' || s.toUpperCase() === 'NA') return null;
  return s;
}

function dateOrNull(v: unknown): string | null {
  const s = str(v);
  if (!s || s.toUpperCase() === 'NA') return null;
  return s;
}

/** Reverse lookup of TUEF account-type labels: "Personal Loan" → "05". */
const ACCOUNT_TYPE_SYMBOL_BY_LABEL: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [symbol, label] of Object.entries(ACCOUNT_TYPE_LABELS)) {
    out[normalizeAccountTypeLabel(label)] = symbol;
  }
  // Common vendor spelling variants not matching the TUEF label verbatim.
  Object.assign(out, {
    'home loan': '02',
    'auto loan': '01',
    'car loan': '01',
    'two wheeler loan': '13',
    'business loan': '51',
    'loan against shares/securities': '15',
  });
  return out;
})();

function normalizeAccountTypeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Map a Surepass account-type label (or numeric code) to a TUEF symbol. */
export function surepassAccountTypeToTuefSymbol(raw: unknown): string | null {
  const s = str(raw);
  if (!s) return null;
  if (/^\d+$/.test(s)) return s.padStart(2, '0');
  return ACCOUNT_TYPE_SYMBOL_BY_LABEL[normalizeAccountTypeLabel(s)] ?? null;
}

type MonthlyStatusEntry = { date: string; status: string };

/**
 * Fallback when `monthlyPayStatus[]` is absent: decode the TUEF `paymentHistory`
 * string — 3-char DPD/status groups, most recent month first — anchored at
 * `paymentEndDate` (e.g. "074058028…" → 74, 58, 28 DPD).
 */
function decodePaymentHistoryString(account: Record<string, unknown>): MonthlyStatusEntry[] {
  const raw = str(account.paymentHistory);
  const end = dateOrNull(account.paymentEndDate);
  if (!raw || !end || raw.length % 3 !== 0) return [];

  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(endDate.getTime())) return [];

  const entries: MonthlyStatusEntry[] = [];
  for (let i = 0; i * 3 < raw.length; i++) {
    const group = raw.slice(i * 3, i * 3 + 3);
    const monthDate = new Date(endDate);
    monthDate.setUTCMonth(monthDate.getUTCMonth() - i);
    const status = /^\d+$/.test(group) ? String(Number.parseInt(group, 10)) : group;
    entries.push({ date: monthDate.toISOString().slice(0, 10), status });
  }
  return entries;
}

function collectMonthlyStatusEntries(account: Record<string, unknown>): MonthlyStatusEntry[] {
  const structured = asArray(account.monthlyPayStatus)
    .map((e) => {
      const rec = asRecord(e);
      if (!rec) return null;
      const date = dateOrNull(rec.date);
      if (!date) return null;
      return { date, status: str(rec.status) ?? 'XXX' };
    })
    .filter((e): e is MonthlyStatusEntry => e !== null);

  return structured.length > 0 ? structured : decodePaymentHistoryString(account);
}

function mapMonthlyPayStatus(entries: MonthlyStatusEntry[], account: Record<string, unknown>): Record<string, unknown> | null {
  if (entries.length === 0) return null;

  const history: Record<string, unknown> = { MonthlyPayStatus: entries };
  const start = dateOrNull(account.paymentStartDate);
  const end = dateOrNull(account.paymentEndDate);
  if (start) history.startDate = start;
  if (end) history.endDate = end;
  return history;
}

/** Most recent monthly status (entries are usually latest-first, but don't rely on order). */
function latestMonthlyStatus(entries: MonthlyStatusEntry[]): string | null {
  let latest: MonthlyStatusEntry | null = null;
  for (const entry of entries) {
    if (!latest || entry.date > latest.date) latest = entry;
  }
  return latest?.status ?? null;
}

function mapTradeline(account: Record<string, unknown>): Record<string, unknown> {
  const symbol = surepassAccountTypeToTuefSymbol(account.accountType);
  const monthlyEntries = collectMonthlyStatusEntries(account);
  const payHistory = mapMonthlyPayStatus(monthlyEntries, account);

  const granted: Record<string, unknown> = {};
  const cashLimit = amountOrNull(account.cash_limit);
  if (cashLimit) {
    // Sanctioned limit; exposure parser reads GrantedTrade.CreditLimit for credit cards.
    granted.CreditLimit = cashLimit;
    granted.CashLimit = cashLimit;
  }
  const emi = amountOrNull(account.emiAmount);
  if (emi) granted.EMIAmount = emi;
  const term = amountOrNull(account.termMonths) ?? amountOrNull(account.repaymentTenure);
  if (term) granted.termMonths = term;
  const interest = amountOrNull(account.interest_rate);
  if (interest) granted.interestRate = interest;
  const pastDue = amountOrNull(account.amountOverdue);
  if (pastDue) granted.amountPastDue = pastDue;
  const lastPayment = dateOrNull(account.lastPaymentDate);
  if (lastPayment) granted.dateLastPayment = lastPayment;
  const frequency = str(account.paymentFrequency);
  if (frequency) granted.PaymentFrequency = { symbol: frequency };
  const collateralValue = amountOrNull(account.collateral_value);
  if (collateralValue) granted.collateral = collateralValue;
  const collateralType = str(account.collateral_type);
  if (collateralType) granted.CollateralType = { description: collateralType };
  if (symbol) granted.AccountType = { symbol };
  if (payHistory) granted.PayStatusHistory = payHistory;

  const tradeline: Record<string, unknown> = {
    creditorName: str(account.memberShortName) ?? 'Lender',
    accountNumber: str(account.accountNumber) ?? '',
    // Raw vendor label — used for MFI keyword detection when no TUEF symbol maps.
    accountTypeDescription: str(account.accountType) ?? '',
    dateOpened: dateOrNull(account.dateOpened),
    dateReported: dateOrNull(account.dateReported),
    currentBalance: str(account.currentBalance),
    highBalance: amountOrNull(account.highCreditAmount),
    // Write-off / settlement sentinels are kept verbatim ("-1" = not reported) —
    // post-BRE flags any non-sentinel value here.
    writtenOffAmtTotal: str(account.woAmountTotal) ?? '-1',
    writtenOffPrincipal: str(account.woAmountPrincipal) ?? '-1',
    settlementAmount: str(account.settlementAmount) ?? '-1',
    AccountDesignator: {
      symbol: str(account.ownershipIndicator)?.toLowerCase() === 'individual' ? '1' : '2',
    },
    GrantedTrade: granted,
  };

  const dateClosed = dateOrNull(account.dateClosed);
  if (dateClosed) tradeline.dateClosed = dateClosed;

  const suitFiled =
    str(account.suitFiledStatus) ?? str(account.suitFiledWillfulDefaultWrittenOff);
  if (suitFiled) tradeline.suitFiledStatus = suitFiled;

  const creditFacilityStatus = str(account.creditFacilityStatus);
  if (creditFacilityStatus) tradeline.CreditFacilityStatus = creditFacilityStatus;

  const currentStatus = latestMonthlyStatus(monthlyEntries);
  if (currentStatus) tradeline.PayStatus = { symbol: currentStatus };
  if (payHistory) tradeline.PayStatusHistory = payHistory;

  return tradeline;
}

function mapBorrower(
  data: Record<string, unknown>,
  report: Record<string, unknown> | null,
): Record<string, unknown> {
  const borrower: Record<string, unknown> = {};

  const primaryName = asRecord(asArray(report?.names)[0]);
  const primaryScore = asRecord(asArray(report?.scores)[0]);

  const fullName = str(primaryName?.name) ?? str(data.name);
  if (fullName) borrower.BorrowerName = { Name: { Forename: fullName } };

  const birthDate = dateOrNull(primaryName?.birthDate);
  if (birthDate) borrower.Birth = { date: birthDate, BirthDate: birthDate };

  const gender = str(primaryName?.gender) ?? str(data.gender);
  if (gender) borrower.Gender = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();

  const riskScore = str(data.credit_score) ?? str(primaryScore?.score);
  const creditScore: Record<string, unknown> = {};
  if (riskScore) creditScore.riskScore = riskScore;
  const scoreName = str(primaryScore?.scoreName);
  if (scoreName) creditScore.scoreName = scoreName;
  if (Object.keys(creditScore).length > 0) borrower.CreditScore = creditScore;

  const emails = asArray(report?.emails)
    .map((e) => str(asRecord(e)?.emailID))
    .filter((e): e is string => e !== null)
    .map((email) => ({ Email: email }));
  if (emails.length > 0) borrower.EmailAddress = emails;

  const phones = asArray(report?.telephones)
    .map((t) => {
      const rec = asRecord(t);
      const number = str(rec?.telephoneNumber);
      if (!number) return null;
      const type = str(rec?.telephoneType);
      return {
        PhoneNumber: { Number: number },
        ...(type ? { PhoneType: { symbol: type } } : {}),
      };
    })
    .filter((p) => p !== null);
  if (phones.length > 0) borrower.BorrowerTelephone = phones;

  const addresses = asArray(report?.addresses)
    .map((a) => {
      const rec = asRecord(a);
      if (!rec) return null;
      const line1 = str(rec.line1);
      const line2 = str(rec.line2);
      const streetAddress = [line1, line2].filter(Boolean).join(' ');
      if (!streetAddress) return null;
      const category = str(rec.addressCategory);
      const dateReported = dateOrNull(rec.dateReported);
      return {
        ...(category ? { Dwelling: { symbol: category } } : {}),
        ...(dateReported ? { dateReported } : {}),
        CreditAddress: {
          StreetAddress: streetAddress,
          ...(str(rec.pinCode) ? { PostalCode: str(rec.pinCode) } : {}),
        },
      };
    })
    .filter((a) => a !== null);
  if (addresses.length > 0) borrower.BorrowerAddress = addresses;

  const identifiers = asArray(report?.ids)
    .map((idNode) => {
      const rec = asRecord(idNode);
      const idNumber = str(rec?.idNumber);
      if (!idNumber) return null;
      return { ID: { Id: idNumber, IdentifierName: str(rec?.idType) ?? 'ID' } };
    })
    .filter((i) => i !== null);
  if (identifiers.length > 0) borrower.IdentifierPartition = { Identifier: identifiers };

  const employment = asRecord(asArray(report?.employment)[0]);
  if (employment) {
    const employer: Record<string, unknown> = {};
    const occupation = str(employment.occupationCode);
    if (occupation) employer.OccupationCode = { description: occupation };
    const dateReported = dateOrNull(employment.dateReported);
    if (dateReported) employer.dateReported = dateReported;
    const accountSymbol = surepassAccountTypeToTuefSymbol(employment.accountType);
    if (accountSymbol) employer.account = accountSymbol;
    const name = str(employment.name);
    if (name) employer.name = name;
    if (Object.keys(employer).length > 0) borrower.Employer = employer;
  }

  return borrower;
}

function mapTrueLinkCreditReport(data: Record<string, unknown>): Record<string, unknown> {
  const report = asRecord(asArray(data.credit_report)[0]);

  const tlr: Record<string, unknown> = {
    Borrower: mapBorrower(data, report),
  };

  const controlNumber = str(report?.control_number);
  if (controlNumber) tlr.ReferenceKey = controlNumber;

  const primaryScore = asRecord(asArray(report?.scores)[0]);
  const asOfDate = dateOrNull(primaryScore?.scoreDate);
  if (asOfDate) {
    // Bureau as-of date consumed by resolveBureauAsOfDate / report header.
    tlr.Sources = { Source: { InquiryDate: asOfDate } };
  }

  const partitions = asArray(report?.accounts)
    .map((a) => {
      const account = asRecord(a);
      if (!account) return null;
      const symbol = surepassAccountTypeToTuefSymbol(account.accountType);
      return {
        ...(symbol ? { accountTypeSymbol: symbol } : {}),
        accountTypeDescription: str(account.accountType) ?? '',
        Tradeline: mapTradeline(account),
      };
    })
    .filter((p) => p !== null);
  if (partitions.length > 0) tlr.TradeLinePartition = partitions;

  const inquiries = asArray(report?.enquiries)
    .map((e) => {
      const rec = asRecord(e);
      if (!rec) return null;
      const inquiryDate = dateOrNull(rec.enquiryDate);
      if (!inquiryDate) return null;
      return {
        Inquiry: {
          enqControlNum: controlNumber ? `${controlNumber}-${str(rec.index) ?? ''}` : null,
          inquiryDate,
          // TUEF enquiry purpose codes ("05" personal loan, "10" credit card, …)
          // — same code set the post-BRE enquiry rules already understand.
          inquiryType: str(rec.enquiryPurpose),
          subscriberName: str(rec.memberShortName),
          amount: amountOrNull(rec.enquiryAmount),
        },
      };
    })
    .filter((i) => i !== null);
  if (inquiries.length > 0) tlr.InquiryPartition = inquiries;

  return tlr;
}

/**
 * Wrap a raw Surepass CIBIL response into the Tenacio bureau envelope.
 *
 * Success → `{ status: 'success', serviceStatusCode: 200, data.cibilData… }`.
 * Failure → `{ status: 'error', serviceStatusCode, serviceError.message }`, so
 * the existing New-To-Credit / outage classification in BureauFetchService
 * (via `extractVendorServiceError`) applies unchanged.
 */
export function mapSurepassCibilToTenacioEnvelope(
  rawBody: unknown,
  httpStatus: number | null,
): Record<string, unknown> {
  const root = asRecord(rawBody);
  const data = root ? asRecord(root.data) : null;
  const statusCode =
    root && typeof root.status_code === 'number' && Number.isFinite(root.status_code)
      ? root.status_code
      : httpStatus;
  const succeeded = root?.success === true && (statusCode == null || statusCode === 200) && data != null;

  if (!succeeded) {
    const message =
      str(root?.message) ??
      str(root?.message_code) ??
      'Surepass CIBIL fetch failed';
    return {
      sourceVendor: 'Surepass',
      status: 'error',
      serviceStatusCode: statusCode ?? 500,
      serviceError: { message },
      requestId: str(data?.client_id),
    };
  }

  return {
    sourceVendor: 'Surepass',
    type: 'point',
    status: 'success',
    serviceStatusCode: 200,
    requestId: str(data.client_id),
    data: {
      cibilData: {
        GetCustomerAssetsResponse: {
          ResponseStatus: 'Success',
          GetCustomerAssetsSuccess: {
            Asset: {
              Type: 'SingleCreditReport',
              TrueLinkCreditReport: mapTrueLinkCreditReport(data),
            },
          },
        },
      },
    },
  };
}
