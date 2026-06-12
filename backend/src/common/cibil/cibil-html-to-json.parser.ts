// @ts-nocheck — ported from scripts/convert-cibil-html-to-json.mjs; typed at export boundary only.
/**
 * Converts Tenacio / myscore.cibil.com HTML credit reports into vendor-style CIBIL JSON.
 */
import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';

export type CibilHtmlConversionMeta = {
  convertedFromHtml: string;
  convertedAt: string;
  accountCount: number;
  inquiryCount: number;
};

export type CibilHtmlVendorJson = Record<string, unknown> & {
  _meta: CibilHtmlConversionMeta;
};

const MONTH_COLUMNS = ['DEC', 'NOV', 'OCT', 'SEP', 'AUG', 'JUL', 'JUN', 'MAY', 'APR', 'MAR', 'FEB', 'JAN'];

const ACCOUNT_TYPE_LABEL_TO_CODE = buildReverseLabelMap({
  '01': 'Auto loan',
  '02': 'Housing loan',
  '03': 'Property loan',
  '04': 'Loan against property',
  '05': 'Personal loan',
  '06': 'Consumer loan',
  '07': 'Gold loan',
  '08': 'Education loan',
  '09': 'Loan to professional',
  '10': 'Credit card',
  '11': 'Lease',
  '12': 'Overdraft',
  '13': 'Two-wheeler loan',
  '14': 'Non-funded credit facility',
  '15': 'Loan against bank deposits',
  '16': 'Fleet card',
  '17': 'Commercial vehicle loan',
  '40': 'Microfinance – business',
  '41': 'Microfinance – personal',
  '42': 'Microfinance – housing',
  '43': 'Microfinance – other',
});

const INQUIRY_PURPOSE_LABEL_TO_CODE = buildReverseLabelMap({
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
  '05-alt': 'Personal Loan',
  '06-alt': 'Consumer Loan',
  '13-alt': 'Two-wheeler Loan',
});

INQUIRY_PURPOSE_LABEL_TO_CODE.set(normalizeLabel('Personal Loan'), '05');
INQUIRY_PURPOSE_LABEL_TO_CODE.set(normalizeLabel('Consumer Loan'), '06');
INQUIRY_PURPOSE_LABEL_TO_CODE.set(normalizeLabel('Two-wheeler Loan'), '13');

ACCOUNT_TYPE_LABEL_TO_CODE.set(normalizeLabel('Microfinance - Personal Loan'), '41');
ACCOUNT_TYPE_LABEL_TO_CODE.set(normalizeLabel('Microfinance - Business Loan'), '40');
ACCOUNT_TYPE_LABEL_TO_CODE.set(normalizeLabel('Microfinance - Housing Loan'), '42');
ACCOUNT_TYPE_LABEL_TO_CODE.set(normalizeLabel('Microfinance - Other'), '43');
ACCOUNT_TYPE_LABEL_TO_CODE.set(normalizeLabel('Microfinance Personal Loan'), '41');
ACCOUNT_TYPE_LABEL_TO_CODE.set(normalizeLabel('Microfinance Business Loan'), '40');

const DWELLING_LABEL_TO_CODE = buildReverseLabelMap({
  '01': 'Permanent address',
  '02': 'Residence address',
  '03': 'Office address',
  '04': 'Not categorized',
});
DWELLING_LABEL_TO_CODE.set(normalizeLabel('Not Categorized'), '04');

const PHONE_TYPE_LABEL_TO_CODE = buildReverseLabelMap({
  '01': 'Mobile phone',
  '02': 'Office phone',
  '03': 'Home phone',
});
PHONE_TYPE_LABEL_TO_CODE.set(normalizeLabel('Mobile Phone'), '01');

const PAYMENT_FREQUENCY_TO_CODE = buildReverseLabelMap({ '03': 'Monthly', '04': 'Quarterly' });
const OWNERSHIP_TO_CODE = buildReverseLabelMap({
  '1': 'Individual',
  '2': 'Joint',
  '3': 'Authorized User',
  '4': 'Guarantor',
});

function buildReverseLabelMap(entries) {
  const map = new Map();
  for (const [code, label] of Object.entries(entries)) {
    if (!code.endsWith('-alt')) map.set(normalizeLabel(label), code);
  }
  return map;
}

function normalizeLabel(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function decodeHtml(text) {
  return String(text ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html) {
  if (html == null) return '';
  return decodeHtml(String(html).replace(/<[^>]+>/g, ' '));
}

function cleanText(value) {
  if (value == null) return '';
  return stripTags(value).replace(/\s+/g, ' ').replace(/DD-MM-YYYY/gi, '').trim();
}

function slugify(name) {
  return basename(name, '.html')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseIndianDate(raw) {
  const text = cleanText(raw);
  const m = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toCibilDate(raw) {
  const iso = parseIndianDate(raw);
  return iso ? `${iso}+05:30` : null;
}

function toCibilMonthDate(raw) {
  const iso = parseIndianDate(raw);
  return iso ? `${iso.slice(0, 7)}-01+05:30` : null;
}

function parseAmount(raw) {
  const text = cleanText(raw);
  if (!text || text === '-') return -1;
  const n = Number.parseInt(text.replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : -1;
}

function parseRate(raw) {
  const text = cleanText(raw);
  if (!text || text === '-') return -1;
  const n = Number.parseFloat(text.replace(/,/g, ''));
  return Number.isFinite(n) ? n : -1;
}

function rankSymbol(symbol, description = '') {
  return { rank: '100000', symbol: String(symbol ?? ''), description, abbreviation: '' };
}

function syntheticSerial(seed) {
  const hash = createHash('sha256').update(seed).digest();
  return Number(hash.readUInt32BE(0));
}

function matchAll(html, regex) {
  const out = [];
  let m;
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  while ((m = re.exec(html)) !== null) out.push(m);
  return out;
}

function extractSection(html, title) {
  const re = new RegExp(
    `<h3>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h3>[\\s\\S]*?(?=<div class="common-header"|<hr|<script|$)`,
    'i',
  );
  const m = html.match(re);
  return m ? m[0] : '';
}

function extractTables(sectionHtml) {
  return matchAll(sectionHtml, /<table[\s\S]*?<\/table>/gi).map((m) => m[0]);
}

function extractTableRows(tableHtml) {
  return matchAll(tableHtml, /<tr[\s\S]*?<\/tr>/gi).map((m) => m[0]);
}

function extractCells(rowHtml) {
  return matchAll(rowHtml, /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi).map((m) => cleanText(m[1]));
}

function extractScore(html) {
  const span = html.match(/class="scoretxt"[\s\S]*?<span>(\d+)<\/span>/i);
  if (span) return Number.parseInt(span[1], 10);
  const script = html.match(/values:\s*\[Number\("(\d+)"\)\]/);
  return script ? Number.parseInt(script[1], 10) : null;
}

function extractFetchedOn(html) {
  const header = html.match(/CIBIL Score Fetched On\s+(\d{4}-\d{2}-\d{2})/i);
  return header ? `${header[1]}+05:30` : null;
}

function extractPersonalInfo(html) {
  const section = extractSection(html, 'Personal Information');
  let name = null;
  let dob = null;
  let gender = null;

  for (const table of extractTables(section)) {
    const headers = extractCells(extractTableRows(table)[0] ?? '').join('|');
    if (!headers.includes('Name') || !headers.includes('Date of Birth')) continue;
    const dataRow = extractTableRows(table)[1];
    if (!dataRow) continue;
    const cells = extractCells(dataRow);
    name = cells[0] || null;
    dob = cells[1] || null;
    gender = cells[2] || null;
    break;
  }

  const identifiers = [];
  for (const table of extractTables(section)) {
    for (const row of extractTableRows(table)) {
      const cells = extractCells(row);
      if (cells.length !== 4) continue;
      const [type, number] = cells;
      if (!type || !number || number === '-') continue;
      if (type.includes('Income Tax ID') || type.includes('PAN')) {
        identifiers.push({ type: 'TaxId', number });
      } else if (type.toUpperCase().includes('CKYC')) {
        identifiers.push({ type: 'CkycId', number });
      }
    }
  }

  return { name, dob, gender, identifiers };
}

function splitName(fullName) {
  const parts = cleanText(fullName).split(' ').filter(Boolean);
  if (parts.length === 0) return { forename: '', surname: '' };
  if (parts.length === 1) return { forename: parts[0], surname: '' };
  return { forename: parts[0], surname: parts.slice(1).join(' ') };
}

function extractAddresses(html) {
  const section = extractSection(html, 'Contact Information');
  const addresses = [];
  for (const table of extractTables(section)) {
    const firstHeader = cleanText((extractCells(extractTableRows(table)[0] ?? '')[0] ?? ''));
    if (!firstHeader.toLowerCase().includes('address')) continue;
    for (const row of extractTableRows(table).slice(1)) {
      const cells = extractCells(row);
      if (cells.length < 4) continue;
      const [address, category, , dateReported] = cells;
      const pinMatch = address.match(/-\s*(\d{6})\s*$/);
      addresses.push({
        address,
        streetAddress: address.replace(/\s*-\s*\d{6}\s*$/, '').trim(),
        pincode: pinMatch ? pinMatch[1] : '',
        category,
        dateReported,
      });
    }
  }
  return addresses;
}

function extractPhones(html) {
  const section = extractSection(html, 'Contact Information');
  const phones = [];
  for (const table of extractTables(section)) {
    const headerRow = extractTableRows(table)[0] ?? '';
    if (!extractCells(headerRow).includes('Telephone Number')) continue;
    for (const row of extractTableRows(table).slice(1)) {
      const cells = extractCells(row);
      if (cells.length < 2) continue;
      phones.push({ type: cells[0], number: cells[1] });
    }
  }
  return phones;
}

function extractEmails(html) {
  const section = extractSection(html, 'Contact Information');
  const emails = [];
  for (const table of extractTables(section)) {
    const headerRow = extractTableRows(table)[0] ?? '';
    if (!extractCells(headerRow).includes('Email Address')) continue;
    for (const row of extractTableRows(table).slice(1)) {
      const email = extractCells(row)[0];
      if (email) emails.push(email);
    }
  }
  return emails;
}

function extractEmployment(html) {
  const section = extractSection(html, 'Employment Information');
  const tables = extractTables(section);
  if (tables.length === 0) return { occupation: '', dateReported: '', accountType: '' };
  const cells = extractCells(extractTableRows(tables[0])[1] ?? '');
  return {
    accountType: cells[0] ?? '',
    dateReported: cells[1] ?? '',
    occupation: cells[2] ?? '',
  };
}

function extractFieldMap(tableHtml) {
  const fields = new Map();
  for (const row of extractTableRows(tableHtml)) {
    const cells = extractCells(row);
    if (cells.length >= 2 && cells[0]) fields.set(cells[0], cells[1]);
    if (cells.length >= 4 && cells[2]) fields.set(cells[2], cells[3]);
  }
  return fields;
}

function getField(fields, ...labels) {
  for (const label of labels) {
    if (fields.has(label)) return fields.get(label);
  }
  const normalizedTargets = labels.map((label) => normalizeLabel(label));
  for (const [key, value] of fields.entries()) {
    if (normalizedTargets.includes(normalizeLabel(key))) return value;
  }
  return '';
}

function parseSuitFiledWilfulDefault(raw) {
  const text = cleanText(raw);
  if (!text || text === '-') return '';
  const norm = normalizeLabel(text);
  if (norm.includes('no suit')) return '00';
  if (norm.includes('wilful') && norm.includes('suit')) return '03';
  if (norm.includes('wilful')) return '02';
  if (norm.includes('suit')) return '01';
  if (/^\d+$/.test(text)) return text.padStart(2, '0');
  return text.toUpperCase();
}

function parseCollateralType(raw) {
  const text = cleanText(raw);
  if (!text || text === '-') return '';
  return text;
}

function extractPaymentGrid(tableHtml) {
  const grid = new Map();
  const nestedMatch = tableHtml.match(/Days Past Due[\s\S]*?<table[\s\S]*?<\/table>/i);
  if (!nestedMatch) return grid;
  for (const row of extractTableRows(nestedMatch[0])) {
    const cells = extractCells(row);
    if (cells.length < 2) continue;
    const year = cells[0];
    if (!/^\d{4}$/.test(year)) continue;
    for (let i = 1; i < cells.length && i - 1 < MONTH_COLUMNS.length; i++) {
      const month = MONTH_COLUMNS[i - 1];
      if (cells[i]) grid.set(`${year}-${month}`, cells[i]);
    }
  }
  return grid;
}

function buildMonthlyPayStatus(startRaw, endRaw, grid) {
  const startIso = parseIndianDate(startRaw);
  const endIso = parseIndianDate(endRaw);
  if (!startIso || !endIso) return { monthly: [], statusString: '' };

  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  if (start > end) return { monthly: [], statusString: '' };

  const monthly = [];
  const statuses = [];
  const cursor = new Date(end);
  while (cursor >= start) {
    const year = cursor.getUTCFullYear();
    const monthNum = cursor.getUTCMonth() + 1;
    const monthLabel = MONTH_COLUMNS[12 - monthNum];
    const status = grid.get(`${year}-${monthLabel}`) ?? 'XXX';
    monthly.push({
      date: `${year}-${String(monthNum).padStart(2, '0')}-01+05:30`,
      status,
    });
    statuses.unshift(status);
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }

  return { monthly, statusString: statuses.length ? `${statuses.join(',')},` : '' };
}

function extractAccounts(html) {
  const sectionMatch = html.match(/<div class="account-info">([\s\S]*?)<\/div>\s*<div class="common-header"/i);
  const section = sectionMatch ? sectionMatch[1] : '';
  const accounts = [];

  extractTables(section).forEach((tableHtml, index) => {
    const headerCells = extractCells(extractTableRows(tableHtml)[0] ?? '');
    if (headerCells.length < 4) return;

    const [creditor, accountTypeLabel, accountNumber, ownershipLabel] = headerCells;
    const fields = extractFieldMap(tableHtml);
    const paymentGrid = extractPaymentGrid(tableHtml);
    const paymentStart = fields.get('Payment Start Date') ?? '';
    const paymentEnd = fields.get('Payment End Date') ?? '';
    const { monthly, statusString } = buildMonthlyPayStatus(paymentStart, paymentEnd, paymentGrid);

    const accountTypeCode =
      ACCOUNT_TYPE_LABEL_TO_CODE.get(normalizeLabel(accountTypeLabel)) ?? '00';
    const ownershipCode = OWNERSHIP_TO_CODE.get(normalizeLabel(ownershipLabel)) ?? '1';
    const paymentFrequencyCode =
      PAYMENT_FREQUENCY_TO_CODE.get(normalizeLabel(fields.get('Payment Frequency') ?? '')) ?? '03';

    const serialNumber = syntheticSerial(`${accountNumber}|${creditor}|${index}`);
    const sanctioned = parseAmount(fields.get('Sanctioned Amount') ?? fields.get('Credit Limit'));
    const creditLimit = parseAmount(fields.get('Credit Limit') ?? fields.get('Sanctioned Amount'));
    const highBalance = sanctioned > 0 ? sanctioned : creditLimit;

    accounts.push({
      creditor,
      accountTypeLabel,
      accountTypeCode,
      accountNumber,
      ownershipCode,
      fields,
      paymentStart,
      paymentEnd,
      monthly,
      statusString,
      serialNumber,
      sanctioned,
      creditLimit,
      highBalance,
      paymentFrequencyCode,
    });
  });

  return accounts;
}

function extractInquiries(html) {
  const section = extractSection(html, 'Enquiry Information');
  const inquiries = [];
  for (const table of extractTables(section)) {
    for (const row of extractTableRows(table).slice(1)) {
      const cells = extractCells(row);
      if (cells.length < 3) continue;
      const [date, member, purpose] = cells;
      inquiries.push({
        date,
        member,
        purpose,
        purposeCode: INQUIRY_PURPOSE_LABEL_TO_CODE.get(normalizeLabel(purpose)) ?? '10',
        controlNum: syntheticSerial(`${date}|${member}|${purpose}|${inquiries.length}`),
      });
    }
  }
  return inquiries;
}

/** Parse myscore.cibil.com / Tenacio HTML into the bureau vendor JSON envelope. */
export function convertCibilHtmlToVendorJson(
  html: string,
  sourceLabel = 'upload.html',
): CibilHtmlVendorJson {
  const score = extractScore(html);
  const inquiryDate = extractFetchedOn(html) ?? `${new Date().toISOString().slice(0, 10)}+05:30`;
  const personal = extractPersonalInfo(html);
  const { forename, surname } = splitName(personal.name ?? '');
  const addresses = extractAddresses(html);
  const phones = extractPhones(html);
  const emails = extractEmails(html);
  const employment = extractEmployment(html);
  const accounts = extractAccounts(html);
  const inquiries = extractInquiries(html);

  const borrowerKey = String(syntheticSerial(personal.name ?? sourceLabel)).slice(0, 9);
  const referenceKey = String(syntheticSerial(`${sourceLabel}|ref`)).slice(0, 11);
  const sourceRef = randomUUID();

  const borrowerAddress = addresses.map((addr, idx) => ({
    Origin: rankSymbol(''),
    Source: {
      Bureau: rankSymbol('CIBIL'),
      Locale: 'en_IN',
      Reference: sourceRef,
      BorrowerKey: borrowerKey,
      InquiryDate: inquiryDate,
    },
    Dwelling: rankSymbol(DWELLING_LABEL_TO_CODE.get(normalizeLabel(addr.category)) ?? '04'),
    Ownership: rankSymbol(''),
    enrichMode: 'R',
    addressOrder: String(idx),
    dateReported: toCibilDate(addr.dateReported),
    partitionSet: String(idx),
    CreditAddress: {
      City: '',
      Region: '',
      PostalCode: addr.pincode,
      AddressType: '',
      SerialNumber: String(syntheticSerial(`${addr.address}|${idx}`)),
      StreetAddress: addr.streetAddress || addr.address,
    },
  }));

  const borrowerTelephone = phones.map((phone, idx) => ({
    Source: {
      Bureau: rankSymbol('CIBIL'),
      Locale: 'en_IN',
      Reference: sourceRef,
      BorrowerKey: borrowerKey,
      InquiryDate: inquiryDate,
    },
    PhoneType: rankSymbol(PHONE_TYPE_LABEL_TO_CODE.get(normalizeLabel(phone.type)) ?? '01'),
    enrichMode: 'R',
    PhoneNumber: {
      Number: phone.number,
      SerialNumber: String(syntheticSerial(`${phone.number}|${idx}`)),
    },
    partitionSet: String(idx),
  }));

  const emailAddress = emails.map((email, idx) => ({
    Email: email.toUpperCase(),
    serialNumber: String(syntheticSerial(`${email}|${idx}`)),
  }));

  const identifiers = [
    {
      ID: { Id: borrowerKey, IdentifierName: 'SocialId' },
      Source: {
        Bureau: rankSymbol('CIBIL'),
        Locale: 'en_IN',
        Reference: sourceRef,
        BorrowerKey: borrowerKey,
        InquiryDate: inquiryDate,
      },
    },
    ...personal.identifiers.map((id, idx) => ({
      ID: {
        Id: id.number,
        SerialNumber: String(syntheticSerial(`${id.number}|${idx}`)),
        IdentifierName: id.type,
      },
      Source: {
        Bureau: rankSymbol('CIBIL'),
        Locale: 'en_IN',
        Reference: sourceRef,
        BorrowerKey: borrowerKey,
        InquiryDate: inquiryDate,
      },
      enrichMode: 'R',
    })),
  ];

  const tradeLinePartition = accounts.map((acct, position) => {
    const dateClosedRaw = getField(acct.fields, 'Date Closed');
    const dateClosed =
      dateClosedRaw && dateClosedRaw !== '-' ? toCibilDate(dateClosedRaw) : undefined;
    const collateralValue = parseAmount(getField(acct.fields, 'Value Of Collateral', 'Value of Collateral'));
    const collateralType = parseCollateralType(
      getField(acct.fields, 'Type Of Collateral', 'Type of Collateral'),
    );
    const suitFiledCode = parseSuitFiledWilfulDefault(
      getField(acct.fields, 'Suit Filed/WilfulDefault', 'Suit Filed / Wilful Default'),
    );
    const writtenOffTotal = parseAmount(
      getField(
        acct.fields,
        'Written-Off Amount(Total)',
        'Written-Off Amount (Total)',
        'Written-off Amount(Total)',
      ),
    );
    const writtenOffPrincipal = parseAmount(
      getField(
        acct.fields,
        'Written-Off Amount(Principal)',
        'Written-Off Amount (Principal)',
        'Written-off Amount(Principal)',
      ),
    );
    const settlementAmount = parseAmount(getField(acct.fields, 'Settlement Amount'));

    return {
      Tradeline: {
        Source: {
          Bureau: rankSymbol('CIBIL'),
          Locale: 'en_IN',
          Reference: sourceRef,
          BorrowerKey: borrowerKey,
          InquiryDate: inquiryDate,
        },
        branch: '',
        bureau: '',
        position: String(position),
        PayStatus: rankSymbol(''),
        OpenClosed: rankSymbol(''),
        dateOpened: toCibilDate(getField(acct.fields, 'Date Opened/Disbursed', 'Date Opened / Disbursed') ?? ''),
        ...(dateClosed ? { dateClosed } : {}),
        DisputeFlag: rankSymbol(''),
        highBalance: String(acct.highBalance > 0 ? acct.highBalance : 0),
        GrantedTrade: {
          TermType: rankSymbol(''),
          CashLimit: String(parseAmount(getField(acct.fields, 'Cash Limit'))),
          EMIAmount: String(parseAmount(getField(acct.fields, 'EMI Amount'))),
          CreditType: rankSymbol(acct.accountTypeCode),
          collateral: String(collateralValue),
          termMonths: String(parseAmount(getField(acct.fields, 'Repayment Tenure'))),
          AccountType: rankSymbol(acct.accountTypeCode),
          CreditLimit: String(acct.creditLimit > 0 ? acct.creditLimit : acct.sanctioned),
          interestRate: String(parseRate(getField(acct.fields, 'Rate Of Interest', 'Rate of Interest'))),
          serialNumber: String(acct.serialNumber),
          amountPastDue: String(parseAmount(getField(acct.fields, 'Amount Overdue'))),
          CollateralType: collateralType
            ? rankSymbol('', collateralType)
            : rankSymbol(''),
          WorstPayStatus: rankSymbol(''),
          dateLastPayment: toCibilDate(getField(acct.fields, 'Date Of Last Payment', 'Date of Last Payment') ?? ''),
          PayStatusHistory: {
            status: acct.statusString,
            endDate: toCibilMonthDate(acct.paymentEnd),
            startDate: toCibilMonthDate(acct.paymentStart),
            MonthlyPayStatus: acct.monthly,
          },
          PaymentFrequency: rankSymbol(acct.paymentFrequencyCode),
          actualPaymentAmount: String(parseAmount(getField(acct.fields, 'Actual Payment Amount'))),
        },
        IndustryCode: rankSymbol(''),
        creditorName: acct.creditor,
        dateReported: toCibilDate(
          getField(acct.fields, 'Date Reported and Certified', 'Date Reported And Certified') ?? '',
        ),
        accountNumber: acct.accountNumber,
        accountsSoldTo: '',
        currentBalance: String(parseAmount(getField(acct.fields, 'Current Balance'))),
        subscriberCode: String((acct.serialNumber % 9000000) + 1000000),
        thirdPartyName: '',
        AccountCondition: rankSymbol(''),
        noOfParticipants: '',
        settlementAmount: String(settlementAmount),
        AccountDesignator: rankSymbol(acct.ownershipCode),
        dateAccountStatus: toCibilDate(getField(acct.fields, 'Date Of Last Payment', 'Date of Last Payment') ?? ''),
        writtenOffAmtTotal: String(writtenOffTotal),
        writtenOffPrincipal: String(writtenOffPrincipal),
        SuitFiled: suitFiledCode ? rankSymbol(suitFiledCode) : rankSymbol(''),
        suitFiledWilfulDefault: suitFiledCode || undefined,
        accountTypeDescription: acct.accountTypeLabel,
        VerificationIndicator: rankSymbol(''),
      },
      accountTypeSymbol: acct.accountTypeCode,
      accountTypeDescription: acct.accountTypeLabel,
      accountTypeAbbreviation: '',
    };
  });

  const inquiryPartition = inquiries.map((inq) => ({
    Inquiry: {
      Source: {
        Bureau: rankSymbol('CIBIL'),
        Locale: 'en_IN',
        Reference: sourceRef,
        BorrowerKey: borrowerKey,
        InquiryDate: inquiryDate,
      },
      amount: '10000',
      bureau: '',
      description: '',
      inquiryDate: toCibilDate(inq.date),
      inquiryType: inq.purposeCode,
      IndustryCode: rankSymbol(''),
      enqControlNum: String(inq.controlNum),
      subscriberName: inq.member,
      subscriberNumber: '',
    },
  }));

  const dobIso = parseIndianDate(personal.dob ?? '');
  const [dobYear, dobMonth, dobDay] = dobIso ? dobIso.split('-') : ['', '', ''];

  return {
    data: {
      htmlUrl: null,
      cibilData: {
        GetCustomerAssetsResponse: {
          ResponseKey: randomUUID().replace(/-/g, '').slice(0, 32),
          ResponseStatus: 'Success',
          GetCustomerAssetsSuccess: {
            Asset: {
              Type: 'SingleCreditReport',
              Status: 'Active',
              AssetId: String(syntheticSerial(sourceLabel)).slice(0, 11),
              CreationDate: inquiryDate.replace('+05:30', '.000+05:30'),
              ExpirationDate: inquiryDate.replace('+05:30', '.000+05:30'),
              SafetyCheckFailure: false,
              TrueLinkCreditReport: {
                Frozen: '',
                Message: { Code: rankSymbol(''), Type: rankSymbol('ZZ'), text: '' },
                Sources: {
                  Source: {
                    Bureau: rankSymbol('CIBIL'),
                    InquiryDate: inquiryDate.replace('+05:30', '.000+05:30'),
                    OriginalData: '',
                  },
                },
                Borrower: {
                  Birth: {
                    age: '0',
                    date: dobIso ? `${dobIso}+05:30` : '',
                    Source: {
                      Bureau: rankSymbol('CIBIL'),
                      Locale: 'en_IN',
                      Reference: sourceRef,
                      BorrowerKey: borrowerKey,
                      InquiryDate: inquiryDate,
                    },
                    BirthDate: { day: dobDay, year: dobYear, month: dobMonth },
                    partitionSet: '0',
                  },
                  Gender:
                    normalizeLabel(personal.gender) === 'male'
                      ? 'Male'
                      : normalizeLabel(personal.gender) === 'female'
                        ? 'Female'
                        : personal.gender ?? '',
                  Employer: {
                    name: '',
                    Source: {
                      Bureau: rankSymbol('CIBIL'),
                      Locale: 'en_IN',
                      Reference: sourceRef,
                      BorrowerKey: borrowerKey,
                      InquiryDate: inquiryDate,
                    },
                    account: '10',
                    dateReported: toCibilDate(employment.dateReported),
                    partitionSet: '0',
                    serialNumber: String(syntheticSerial(`${employment.occupation}|emp`)),
                    CreditAddress: {
                      City: '',
                      Region: '',
                      PostalCode: '',
                      AddressType: '',
                      StreetAddress: '',
                    },
                    OccupationCode: rankSymbol('01', employment.occupation || 'Salaried'),
                    NetGrossIndicator: '',
                    IncomeFreqIndicator: '',
                  },
                  CreditScore: {
                    Source: {
                      Bureau: rankSymbol('CIBIL'),
                      Locale: 'en_IN',
                      Reference: sourceRef,
                      BorrowerKey: borrowerKey,
                      InquiryDate: inquiryDate,
                    },
                    riskScore: score != null ? String(score) : '',
                    scoreName: 'CIBILTransUnionScore3',
                    NoScoreReason: rankSymbol(''),
                    populationRank: '25',
                    CreditScoreModel: rankSymbol('CIBILTUSC3'),
                    CreditScoreFactor: [],
                  },
                  borrowerKey: borrowerKey,
                  BorrowerName: {
                    Name: { Surname: surname, Forename: forename },
                    Source: {
                      Bureau: rankSymbol('CIBIL'),
                      Locale: 'en_IN',
                      Reference: sourceRef,
                      BorrowerKey: borrowerKey,
                      InquiryDate: inquiryDate,
                    },
                    NameType: rankSymbol(''),
                    partitionSet: '0',
                  },
                  EmailAddress: emailAddress,
                  BorrowerAddress: borrowerAddress,
                  CreditStatement: {
                    Source: {
                      Bureau: rankSymbol('CIBIL'),
                      Locale: 'en_IN',
                      Reference: sourceRef,
                      BorrowerKey: borrowerKey,
                      InquiryDate: inquiryDate,
                    },
                    statement: '',
                    dateUpdated: '',
                    StatementType: rankSymbol('DISPUTE'),
                  },
                  BorrowerTelephone: borrowerTelephone,
                  IdentifierPartition: { Identifier: identifiers },
                },
                ReferenceKey: referenceKey,
                FraudIndicator: false,
                currentversion: '5.0',
                InquiryPartition: inquiryPartition,
                DeceasedIndicator: false,
                SafetyCheckPassed: true,
                TradeLinePartition: tradeLinePartition,
              },
            },
          },
        },
      },
    },
    type: 'point',
    status: 'success',
    requestId: randomUUID(),
    vendorResponse: [{ name: 'SapphireSwan', sequence: 1, statusCode: 200 }],
    serviceStatusCode: 200,
    _meta: {
      convertedFromHtml: basename(sourceLabel),
      convertedAt: new Date().toISOString(),
      accountCount: accounts.length,
      inquiryCount: inquiries.length,
    },
  };
}
