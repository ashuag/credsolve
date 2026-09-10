import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { mapMyMoneyBazaarSoftPullToTenacioEnvelope } from './mymoneybazaar-cibil-to-tenacio.mapper';
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
});

describe('mapMyMoneyBazaarSoftPullToTenacioEnvelope (PayMe India flat)', () => {
  const wrapped = mapMyMoneyBazaarSoftPullToTenacioEnvelope(SAMPLE, 200, { fullName: 'Sample Borrower' });

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
