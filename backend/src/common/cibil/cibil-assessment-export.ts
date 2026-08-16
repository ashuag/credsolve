/**
 * Builds one row of the "Credit Assessment data" workbook — the raw per-customer
 * feature columns consumed by the Credit Risk / Data Science team's external
 * CIBIL scoring engine (see `CIBIL_Assessment_Process.md`, section 2 and 11).
 *
 * List-valued columns are serialised as Python list-literal strings (e.g.
 * `"['35000', '7000']"` or `'[1, 1, 1]'`) to match the external engine's parser,
 * which expects that exact `repr()` style. Quoted-string lists hold amounts /
 * dates / labels; unquoted numeric lists hold plain counts and balances.
 */
import {
  CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS,
  TUEF_MFI_ACCOUNT_TYPE_SYMBOLS,
} from './cibil-tuef.constants';
import {
  parseBureauReport,
  parseCibilDate,
  type ParsedBureauTradeline,
} from './cibil-bureau-rules.parser';
import {
  extractCibilAssessmentInsights,
  parseInrAmount,
  CREDIT_CARD_ACCOUNT_TYPES,
  GOLD_LOAN_ACCOUNT_TYPE,
} from './cibil-assessment-insights';
import {
  getTradelineExposureInr,
  isCibilTradelineOpen,
  normalizeCibilAccountTypeSymbol,
  parseCibilTradeline,
} from './cibil-tradeline.parser';

export const CIBIL_ASSESSMENT_EXPORT_HEADERS = [
  'user_id',
  'risk_score',
  'no_of_pan_cards',
  'no_of_address',
  'reported_dates_addr',
  'personal_email',
  'employment_type',
  'no_of_loans',
  'no_of_loans_amount',
  'loans_amount_six_m',
  'loans_amount_tw_m',
  'loans_amount_tf_m',
  'loans_amount_ts_m',
  'loan_contain_status_sma',
  'loan_contain_status_sub',
  'loan_contain_status_dbt',
  'loan_contain_status_lss',
  'max_number_digit',
  'default_loans',
  'writeoff_loan',
  'writeoff_principal_loan',
  'settled_loan',
  'settled_loans_counts',
  'overdue_amounts',
  'total_overdue_amounts',
  'no_of_overdue_amounts',
  'individual_loans',
  'joint_loans',
  'unsecured_guarantor_loans',
  'total_enq',
  'th_d_enq',
  'three_m_enq',
  'six_m_enq',
  'tw_m_enq',
  'tf_m_enq',
  'ts_m_enq',
  'missed_payments_in_6m',
  'emi_payments_in_6m',
  'secured_loans_amount',
  'no_of_secured_loans',
  'unsecured_loans_amount',
  'no_of_unsecured_loans',
  'gold_loans_amount',
  'no_of_gold_loans',
  'fetch_date',
  'sanction_amount',
  'total_sanction_amount',
  'zero_balance',
  'total_zero_balance',
  'no_of_zero_balance',
  'recent_dateOpened',
  'oldest_dateOpened',
  'Closed_Dates',
  'personal_email',
  'no_of_creditcards',
  'cc_loans_loan_amount',
  'no_of_microfinance_loans',
  'no_of_microfinance_loans_opened',
  'microfinance_loans_amount',
  'open_loan_dpd_last_6_months',
  'dpd30_last_3_months',
  'dpd60_last_9_months',
  'dpd90_last_12_months',
  'defaults_in_last_18_months',
  'doubtful_in_last_18_months',
  'restructured_loans',
  'pwos_tradelines',
  'active_unsecured_loans_current_balance',
  'active_unsecured_loans_count',
  'total_active_unsecured_loans_list',
  'total_unsecured_loans',
  'unsecured_guarantor_loans_amount',
  'age',
] as const;

export type CibilAssessmentExportCell = string | number | Date | null;
export type CibilAssessmentExportRow = CibilAssessmentExportCell[];

const DAY_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_DESIGNATOR_GUARANTOR = '3';
const ACCOUNT_DESIGNATOR_INDIVIDUAL = '1';

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

/** `YYYY-MM-DD+05:30`, matching the external engine's expected CIBIL date string. */
function formatRawIstDate(d: Date | null): string | null {
  if (!d) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}+05:30`;
}

function pyQuotedList(items: (string | null)[]): string {
  const filtered = items.filter((v): v is string => v != null && v !== '');
  if (!filtered.length) return '[]';
  return `[${filtered.map((v) => `'${v}'`).join(', ')}]`;
}

function pyNumberList(items: number[]): string {
  if (!items.length) return '[]';
  return `[${items.join(', ')}]`;
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / DAY_MS);
}

type RawTradeline = {
  accountType: string | null;
  isUnsecured: boolean;
  isOpen: boolean;
  isCreditCard: boolean;
  isGoldLoan: boolean;
  isMicrofinance: boolean;
  designator: string | null;
  sanctionedAmount: number;
  currentBalance: number;
  writtenOffPrincipal: number;
  overdueAmount: number;
  dateOpened: Date | null;
  dateClosed: Date | null;
};

/**
 * Export-only exposure amount. For credit cards, this workbook's amount columns
 * (sanction_amount, unsecured_loans_amount, etc.) should reflect credit limit
 * utilization — i.e. the "High Credit" field — rather than the sanctioned
 * CreditLimit. Falls back to the shared exposure logic when High Credit is
 * missing/zero, or for non-credit-card tradelines.
 */
function getExportTradelineAmount(
  tradeline: Record<string, unknown>,
  accountTypeSymbol: string | null,
  isCreditCard: boolean,
): number {
  if (isCreditCard) {
    const highCredit = parseInrAmount(tradeline.highBalance ?? tradeline.HighBalance);
    if (highCredit != null && highCredit > 0) return highCredit;
  }
  return getTradelineExposureInr(tradeline, accountTypeSymbol);
}

function walkRawTradelines(tradelines: ParsedBureauTradeline[]): RawTradeline[] {
  return tradelines.map(({ lineRec, partitionSymbol }) => {
    const parsedLine = parseCibilTradeline(lineRec, partitionSymbol);
    const accountType = parsedLine?.accountTypeSymbol ?? normalizeCibilAccountTypeSymbol(partitionSymbol);
    const granted = asRecord(lineRec.GrantedTrade);
    const isCreditCard = accountType != null && CREDIT_CARD_ACCOUNT_TYPES.has(accountType);

    return {
      accountType,
      isUnsecured: accountType != null && CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS.has(accountType),
      isOpen: parsedLine?.isOpen ?? isCibilTradelineOpen(lineRec),
      isCreditCard,
      isGoldLoan: accountType === GOLD_LOAN_ACCOUNT_TYPE,
      isMicrofinance: accountType != null && TUEF_MFI_ACCOUNT_TYPE_SYMBOLS.has(accountType),
      designator: readSymbol(lineRec.AccountDesignator),
      sanctionedAmount: getExportTradelineAmount(lineRec, accountType, isCreditCard),
      currentBalance: parseInrAmount(lineRec.currentBalance),
      writtenOffPrincipal: parseInrAmount(lineRec.writtenOffPrincipal),
      overdueAmount: parseInrAmount(granted?.amountPastDue ?? lineRec.amountPastDue),
      dateOpened: parseCibilDate(lineRec.dateOpened),
      dateClosed: parseCibilDate(lineRec.dateClosed),
    };
  });
}

function collectBorrowerDetails(vendorBody: unknown): {
  panCount: number;
  addressReportedDates: (string | null)[];
  emails: string[];
  employmentType: string | null;
  dateOfBirth: Date | null;
} {
  const tlr = readTrueLinkCreditReport(vendorBody);
  const borrower = tlr ? asRecord(tlr.Borrower) : null;
  if (!borrower) {
    return { panCount: 0, addressReportedDates: [], emails: [], employmentType: null, dateOfBirth: null };
  }

  const panNumbers = new Set<string>();
  for (const partitionNode of asArray(borrower.IdentifierPartition)) {
    const partition = asRecord(partitionNode);
    if (!partition) continue;
    for (const idNode of asArray(partition.Identifier)) {
      const idRec = asRecord(idNode);
      const idInner = idRec ? asRecord(idRec.ID ?? idRec.id) : null;
      if (!idInner) continue;
      const name = idInner.IdentifierName != null ? String(idInner.IdentifierName) : '';
      const number = idInner.Id ?? idInner.ID ?? idInner.id;
      if (name === 'TaxId' && number != null) {
        const trimmed = String(number).trim();
        if (trimmed) panNumbers.add(trimmed.toUpperCase());
      }
    }
  }

  const addressReportedDates: (string | null)[] = [];
  for (const addrNode of asArray(borrower.BorrowerAddress)) {
    const addrRec = asRecord(addrNode);
    if (!addrRec) continue;
    const creditAddr = asRecord(addrRec.CreditAddress);
    const street = creditAddr?.StreetAddress != null ? String(creditAddr.StreetAddress).trim() : '';
    if (!street) continue;
    addressReportedDates.push(formatRawIstDate(parseCibilDate(addrRec.dateReported)));
  }

  const emails: string[] = [];
  for (const emailNode of asArray(borrower.EmailAddress)) {
    const rec = asRecord(emailNode);
    const email = rec?.Email != null ? String(rec.Email).trim() : '';
    if (email && !emails.includes(email)) emails.push(email);
  }

  const employer = asRecord(borrower.Employer);
  const occ = employer ? asRecord(employer.OccupationCode) : null;
  const employmentType =
    occ?.description != null
      ? String(occ.description).trim() || null
      : employer
        ? readSymbol(employer.OccupationCode)
        : null;

  const birth = asRecord(borrower.Birth);
  const dateOfBirth = birth?.date != null ? parseCibilDate(birth.date) : null;

  return { panCount: panNumbers.size, addressReportedDates, emails, employmentType, dateOfBirth };
}

function formatAge(dob: Date | null, asOf: Date): string | null {
  if (!dob) return null;
  let years = asOf.getUTCFullYear() - dob.getUTCFullYear();
  let months = asOf.getUTCMonth() - dob.getUTCMonth();
  if (asOf.getUTCDate() < dob.getUTCDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;
  return `${years} years ${months} months`;
}

/** Builds one export row for `vendorBody` (a `BureauReport.rawPayload`). */
export function buildCibilAssessmentExportRow(
  vendorBody: unknown,
  userId: number,
  riskScore: number | null,
): CibilAssessmentExportRow {
  const parsed = parseBureauReport(vendorBody);
  const asOf = parsed.bureauAsOfDate;
  const insights = extractCibilAssessmentInsights(parsed, riskScore);
  const tradelines = walkRawTradelines(parsed.tradelines);
  const borrower = collectBorrowerDetails(vendorBody);

  const sanctionedAmounts = tradelines.map((t) => t.sanctionedAmount);
  const currentBalances = tradelines.map((t) => t.currentBalance);
  const overdueAmounts = tradelines.map((t) => t.overdueAmount);
  const writeoffPrincipalAmounts = tradelines.filter((t) => t.writtenOffPrincipal > 0).map((t) => t.writtenOffPrincipal);

  const bucket = (minDays: number, maxDays: number) =>
    tradelines
      .filter((t) => t.dateOpened && daysBetween(t.dateOpened, asOf) >= minDays && daysBetween(t.dateOpened, asOf) < maxDays)
      .map((t) => String(t.sanctionedAmount));

  const individualCount = tradelines.filter((t) => t.designator === ACCOUNT_DESIGNATOR_INDIVIDUAL).length;
  const guarantorCount = tradelines.filter((t) => t.designator === ACCOUNT_DESIGNATOR_GUARANTOR).length;
  const jointCount = tradelines.length - individualCount - guarantorCount;

  const enqCountWithinDays = (days: number) =>
    parsed.enquiries.filter((inq) => daysBetween(inq.date, asOf) >= 0 && daysBetween(inq.date, asOf) < days).length;

  const openTradelinesWithDates = tradelines.filter((t) => t.dateOpened);
  const recentDateOpened = openTradelinesWithDates.length
    ? openTradelinesWithDates.reduce((max, t) => (t.dateOpened! > max ? t.dateOpened! : max), openTradelinesWithDates[0].dateOpened!)
    : null;
  const oldestDateOpened = openTradelinesWithDates.length
    ? openTradelinesWithDates.reduce((min, t) => (t.dateOpened! < min ? t.dateOpened! : min), openTradelinesWithDates[0].dateOpened!)
    : null;

  const closedDates = tradelines.map((t) => (t.isOpen ? 'opened' : formatRawIstDate(t.dateClosed) ?? 'opened'));

  const secured = tradelines.filter((t) => !t.isUnsecured);
  const unsecured = tradelines.filter((t) => t.isUnsecured);
  const goldLoans = tradelines.filter((t) => t.isGoldLoan);
  const creditCards = tradelines.filter((t) => t.isCreditCard);
  const mfiLoans = tradelines.filter((t) => t.isMicrofinance);
  const activeUnsecured = unsecured.filter((t) => t.isOpen);
  const zeroBalanceCount = currentBalances.filter((v) => v === 0).length;

  let emiPaymentsIn6m = 0;
  let maxDpdDays = 0;
  for (const { lineRec } of parsed.tradelines) {
    const payHistory = asRecord(lineRec.PayStatusHistory) ?? asRecord(asRecord(lineRec.GrantedTrade)?.PayStatusHistory);
    if (!payHistory) continue;
    for (const entry of asArray(payHistory.MonthlyPayStatus)) {
      const entryRec = asRecord(entry);
      if (!entryRec) continue;
      const monthDate = parseCibilDate(entryRec.date);
      if (!monthDate) continue;
      if (daysBetween(monthDate, asOf) >= 0 && daysBetween(monthDate, asOf) < 183) emiPaymentsIn6m += 1;
      const status = String(entryRec.status ?? '').trim();
      if (/^\d+$/.test(status)) maxDpdDays = Math.max(maxDpdDays, Number.parseInt(status, 10));
    }
  }

  const row: Record<(typeof CIBIL_ASSESSMENT_EXPORT_HEADERS)[number], CibilAssessmentExportCell> = {
    user_id: userId,
    risk_score: riskScore ?? 0,
    no_of_pan_cards: borrower.panCount,
    no_of_address: borrower.addressReportedDates.length,
    reported_dates_addr: pyQuotedList(borrower.addressReportedDates),
    personal_email: pyQuotedList(borrower.emails),
    employment_type: borrower.employmentType,
    no_of_loans: insights.noOfLoans,
    no_of_loans_amount: pyQuotedList(sanctionedAmounts.map(String)),
    loans_amount_six_m: pyQuotedList(bucket(0, 183)),
    loans_amount_tw_m: pyQuotedList(bucket(183, 365)),
    loans_amount_tf_m: pyQuotedList(bucket(365, 730)),
    loans_amount_ts_m: pyQuotedList(bucket(730, 1095)),
    loan_contain_status_sma: pyQuotedList(insights.loanContainStatusSma),
    loan_contain_status_sub: pyQuotedList(insights.loanContainStatusSub),
    loan_contain_status_dbt: pyQuotedList(insights.loanContainStatusDbt),
    loan_contain_status_lss: pyQuotedList(insights.loanContainStatusLss),
    max_number_digit: maxDpdDays,
    default_loans: pyQuotedList(insights.defaultLoans),
    writeoff_loan: pyQuotedList(insights.writeoffLoan),
    writeoff_principal_loan: pyQuotedList(writeoffPrincipalAmounts.map(String)),
    settled_loan: pyQuotedList(insights.settledLoan),
    settled_loans_counts: insights.settledLoansCounts,
    overdue_amounts: pyQuotedList(overdueAmounts.map(String)),
    total_overdue_amounts: insights.totalOverdueAmounts,
    no_of_overdue_amounts: overdueAmounts.filter((v) => v > 0).length,
    individual_loans: pyNumberList(Array(individualCount).fill(1)),
    joint_loans: pyNumberList(Array(jointCount).fill(1)),
    unsecured_guarantor_loans: pyNumberList(Array(guarantorCount).fill(1)),
    total_enq: insights.totalEnq,
    th_d_enq: enqCountWithinDays(30),
    three_m_enq: enqCountWithinDays(91),
    six_m_enq: insights.sixMEnq,
    tw_m_enq: enqCountWithinDays(365),
    tf_m_enq: enqCountWithinDays(730),
    ts_m_enq: enqCountWithinDays(1095),
    missed_payments_in_6m: pyQuotedList(insights.missedPaymentsIn6m),
    emi_payments_in_6m: emiPaymentsIn6m,
    secured_loans_amount: secured.reduce((sum, t) => sum + t.sanctionedAmount, 0),
    no_of_secured_loans: insights.noOfSecuredLoans,
    unsecured_loans_amount: unsecured.reduce((sum, t) => sum + t.sanctionedAmount, 0),
    no_of_unsecured_loans: insights.noOfUnsecuredLoans,
    gold_loans_amount: goldLoans.reduce((sum, t) => sum + t.sanctionedAmount, 0),
    no_of_gold_loans: insights.noOfGoldLoans,
    fetch_date: asOf,
    sanction_amount: pyQuotedList(sanctionedAmounts.map(String)),
    total_sanction_amount: sanctionedAmounts.reduce((sum, v) => sum + v, 0),
    zero_balance: pyQuotedList(currentBalances.map(String)),
    total_zero_balance: currentBalances.reduce((sum, v) => sum + v, 0),
    no_of_zero_balance: zeroBalanceCount,
    recent_dateOpened: formatRawIstDate(recentDateOpened),
    oldest_dateOpened: formatRawIstDate(oldestDateOpened),
    Closed_Dates: pyQuotedList(closedDates),
    no_of_creditcards: insights.noOfCreditcards,
    cc_loans_loan_amount: creditCards.reduce((sum, t) => sum + t.sanctionedAmount, 0),
    no_of_microfinance_loans: mfiLoans.length,
    no_of_microfinance_loans_opened: mfiLoans.filter((t) => t.isOpen).length,
    microfinance_loans_amount: mfiLoans.reduce((sum, t) => sum + t.sanctionedAmount, 0),
    open_loan_dpd_last_6_months: pyQuotedList(insights.openLoanDpdLast6Months),
    dpd30_last_3_months: pyQuotedList(insights.dpd30Last3Months),
    dpd60_last_9_months: pyQuotedList(insights.dpd60Last9Months),
    dpd90_last_12_months: pyQuotedList(insights.dpd90Last12Months),
    defaults_in_last_18_months: pyQuotedList(insights.defaultsInLast18Months),
    doubtful_in_last_18_months: pyQuotedList(insights.doubtfulInLast18Months),
    restructured_loans: pyQuotedList(insights.restructuredLoans),
    pwos_tradelines: pyQuotedList(insights.pwosTradelines),
    active_unsecured_loans_current_balance: activeUnsecured.reduce((sum, t) => sum + t.currentBalance, 0),
    active_unsecured_loans_count: activeUnsecured.length,
    total_active_unsecured_loans_list: pyNumberList(activeUnsecured.map((t) => t.sanctionedAmount)),
    total_unsecured_loans: pyNumberList(unsecured.map((t) => t.sanctionedAmount)),
    unsecured_guarantor_loans_amount: tradelines
      .filter((t) => t.designator === ACCOUNT_DESIGNATOR_GUARANTOR)
      .reduce((sum, t) => sum + t.sanctionedAmount, 0),
    age: formatAge(borrower.dateOfBirth, asOf),
  };

  return CIBIL_ASSESSMENT_EXPORT_HEADERS.map((key) => row[key]);
}
