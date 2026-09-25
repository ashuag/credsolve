import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { mapCibil07SoftPullToTenacioEnvelope } from './cibil07-cibil-to-tenacio.mapper';
import {
  isPayMeIndiaFlatReport,
  payMeAccountTypeToTuefSymbol,
  payMeIndiaFlatToTrueLink,
} from './payme-india-cibil-to-truelink';
import {
  isTenacioBureauSuccessPayload,
  parseTenacioBureauVendorBody,
} from '../tenacio-bureau-payload.mapper';
import { extractTradelinesFromBureauVendorBody } from '../../cibil/cibil-tradeline.parser';
import { auditNoRestructuredLoans } from '../../cibil/cibil-bureau-rules.parser';

const SAMPLE = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/payme-india-soft-pull-hit.sample.json'), 'utf8'),
) as Record<string, unknown>;

function record(v: unknown): Record<string, unknown> {
  return v as Record<string, unknown>;
}

describe('payMeAccountTypeToTuefSymbol', () => {
  it('maps vendor labels to TUEF symbols', () => {
    assert.equal(payMeAccountTypeToTuefSymbol('Credit Card'), '10');
    assert.equal(payMeAccountTypeToTuefSymbol('Consumer Loan'), '06');
    assert.equal(payMeAccountTypeToTuefSymbol('Personal Loan'), '05');
    assert.equal(payMeAccountTypeToTuefSymbol('Housing Loan'), '02');
    assert.equal(payMeAccountTypeToTuefSymbol('07'), '07');
    assert.equal(payMeAccountTypeToTuefSymbol('something unknown'), null);
    assert.equal(
      payMeAccountTypeToTuefSymbol('(BLPS-AGR) Business Loan - Priority Sector - Agriculture'),
      '53',
    );
    assert.equal(payMeAccountTypeToTuefSymbol('BLPS-AGR'), '53');
    assert.equal(
      payMeAccountTypeToTuefSymbol('Business Loan - Priority Sector - Agriculture'),
      '53',
    );
  });
});

describe('isPayMeIndiaFlatReport', () => {
  it('recognises the flat payload', () => {
    const inner = record(record(record(SAMPLE).data).data);
    assert.equal(isPayMeIndiaFlatReport(inner), true);
  });
  it('rejects a TrueLink envelope', () => {
    assert.equal(isPayMeIndiaFlatReport({ cibilData: { GetCustomerAssetsResponse: {} } }), false);
  });
});

describe('payMeIndiaFlatToTrueLink', () => {
  const inner = record(record(record(SAMPLE).data).data);
  const result = payMeIndiaFlatToTrueLink(inner, { fullName: 'Sample Borrower' });

  it('produces a TrueLink report', () => {
    assert.equal(result.ok, true);
    assert.ok(result.trueLinkCreditReport);
  });

  it('maps the score and borrower identity', () => {
    const b = record(result.trueLinkCreditReport!.Borrower);
    assert.deepEqual(b.CreditScore, { riskScore: '782', scoreName: 'CIBILTransUnionScore3' });
    assert.equal(b.Gender, 'Male');
    assert.deepEqual(b.Birth, { date: '1990-01-15', BirthDate: '1990-01-15' });
    assert.deepEqual(record(record(b.BorrowerName).Name), { Forename: 'Sample Borrower' });
  });

  it('maps every tradeline with a symbol and payment history', () => {
    const partitions = result.trueLinkCreditReport!.TradeLinePartition as Array<Record<string, unknown>>;
    assert.equal(partitions.length, 5);
    const symbols = partitions.map((p) => p.accountTypeSymbol).sort();
    assert.deepEqual(symbols, ['06', '06', '10', '10', '10']);
    for (const p of partitions) {
      const t = record(p.Tradeline);
      assert.ok(String(t.creditorName).length > 0);
      const months = record(record(t.GrantedTrade).PayStatusHistory).MonthlyPayStatus as unknown[];
      assert.ok(Array.isArray(months) && months.length > 0);
    }
  });

  it('parses addresses into StreetAddress + PostalCode', () => {
    const addr = record(
      (record(result.trueLinkCreditReport!.Borrower).BorrowerAddress as unknown[])[0],
    );
    const ca = record(addr.CreditAddress);
    assert.match(String(ca.StreetAddress), /GWALIOR/);
    assert.equal(ca.PostalCode, '474006');
  });

  it('flags a no-hit when there is no score and no accounts', () => {
    const nohit = payMeIndiaFlatToTrueLink({ cibil: [], loan_type: [] });
    assert.equal(nohit.ok, false);
  });

  it('maps enquiry member name and loan purpose onto InquiryPartition', () => {
    const result = payMeIndiaFlatToTrueLink({
      cibil: [{ score: '742', cibil_date: '2026-09-17' }],
      loan_type: [],
      member_enquiries_: [
        {
          date: '2024-07-31',
          member: 'HDFC BANK',
          enquiry_purpose: 'Personal Loan',
          amount: 10000,
        },
      ],
    });
    assert.equal(result.ok, true);
    const partitions = result.trueLinkCreditReport!.InquiryPartition as Array<Record<string, unknown>>;
    assert.equal(partitions.length, 1);
    const inquiry = record(partitions[0].Inquiry);
    assert.equal(inquiry.subscriberName, 'HDFC BANK');
    assert.equal(inquiry.inquiryType, '05');
    assert.equal(inquiry.amount, '10000');
  });
});

describe('mapCibil07SoftPullToTenacioEnvelope (PayMe India flat)', () => {
  const wrapped = mapCibil07SoftPullToTenacioEnvelope(SAMPLE, 200, { fullName: 'Sample Borrower' });

  it('returns a success envelope the pipeline accepts', () => {
    assert.equal(wrapped.status, 'success');
    assert.equal(wrapped.serviceStatusCode, 200);
    assert.equal(isTenacioBureauSuccessPayload(wrapped), true);
  });

  it('exposes the score to parseTenacioBureauVendorBody', () => {
    const parsed = parseTenacioBureauVendorBody(wrapped);
    assert.equal(parsed.bureauScore, 782);
    assert.equal(parsed.responseStatus, 'Success');
  });

  it('exposes tradelines to the exposure parser', () => {
    const lines = extractTradelinesFromBureauVendorBody(wrapped);
    assert.equal(lines.length, 5);
    assert.ok(lines.every((l) => l.accountTypeSymbol != null && l.isUnsecured));
  });
});

describe('payMeIndiaFlatToTrueLink account condition', () => {
  it('maps PayMe suitFiledStatus onto Tag 34, not Tag 33, even when the status text is the Tag 33 label', () => {
    const result = payMeIndiaFlatToTrueLink({
      cibil: [{ score: '746', score_name: 'CIBILTransUnionScore3', cibil_date: '2026-09-17' }],
      loan_type: [
        {
          id: '2390651',
          original_loan_type: 'Business Loan - General',
          member_name: 'CENTRAL BANK',
          account_number: '00000003016839118',
          opened_date: '2008-03-12',
          closed_date: '2022-03-30',
          reported_date: '2022-03-31+05:30',
          high_credit: 92500,
          current_balance: 0,
          account_condition_abbreviation: 'suitFiledStatus',
          account_condition_pre_default_status: 'Restructured Loan (Govt. Mandated)',
        },
      ],
    });
    assert.equal(result.ok, true);
    const partitions = result.trueLinkCreditReport?.TradeLinePartition as
      | Array<Record<string, unknown>>
      | undefined;
    const tradeline = partitions?.[0]?.Tradeline as Record<string, unknown> | undefined;
    assert.equal(tradeline?.suitFiledStatus, '01');
    assert.equal(tradeline?.writtenOffSettledStatus, undefined);
    const condition = tradeline?.AccountCondition as Record<string, unknown> | undefined;
    assert.equal(condition?.symbol, '01');
    assert.equal(condition?.abbreviation, 'suitFiledStatus');
  });

  it('maps PayMe creditFacilityStatus moratorium onto CreditFacilityStatus, not Tag 33', () => {
    const result = payMeIndiaFlatToTrueLink({
      cibil: [{ score: '746', score_name: 'CIBILTransUnionScore3', cibil_date: '2026-09-17' }],
      loan_type: [
        {
          id: '30252532',
          original_loan_type: 'Personal Loan',
          member_name: 'HOME CREDIT',
          account_number: '3911701697',
          opened_date: '2019-12-17',
          closed_date: '2023-07-13',
          reported_date: '2023-07-31+05:30',
          high_credit: 59332,
          current_balance: 0,
          account_condition_abbreviation: 'creditFacilityStatus',
          account_condition_pre_default_status: 'Moratorium (Regulatory Measure)',
        },
      ],
    });
    assert.equal(result.ok, true);
    const partitions = result.trueLinkCreditReport?.TradeLinePartition as
      | Array<Record<string, unknown>>
      | undefined;
    const tradeline = partitions?.[0]?.Tradeline as Record<string, unknown> | undefined;
    assert.equal(tradeline?.CreditFacilityStatus, 'Moratorium (Regulatory Measure)');
    assert.equal(tradeline?.writtenOffSettledStatus, undefined);
    assert.equal(tradeline?.suitFiledStatus, undefined);
    const condition = tradeline?.AccountCondition as Record<string, unknown> | undefined;
    assert.equal(condition?.abbreviation, 'creditFacilityStatus');

    const audit = auditNoRestructuredLoans({
      data: {
        cibilData: {
          GetCustomerAssetsResponse: {
            GetCustomerAssetsSuccess: {
              Asset: { TrueLinkCreditReport: result.trueLinkCreditReport },
            },
          },
        },
      },
    });
    assert.equal(audit.passed, false);
    assert.match(audit.findings[0]?.detail ?? '', /Moratorium \(Regulatory Measure\)/);
  });
});
