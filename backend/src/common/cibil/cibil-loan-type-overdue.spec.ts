import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  auditLoanTypeOverdue,
  auditNoRestructuredLoans,
  formatSuitFiledWilfulDefaultLabel,
} from './cibil-bureau-rules.parser';

function bureauWithTradelines(
  partitions: Array<{ accountTypeSymbol: string; tradelines: Record<string, unknown>[] }>,
) {
  return {
    data: {
      cibilData: {
        GetCustomerAssetsResponse: {
          GetCustomerAssetsSuccess: {
            Asset: {
              TrueLinkCreditReport: {
                TradeLinePartition: partitions.map((p) => ({
                  accountTypeSymbol: p.accountTypeSymbol,
                  Tradeline: p.tradelines,
                })),
              },
            },
          },
        },
      },
    },
  };
}

describe('auditLoanTypeOverdue', () => {
  it('passes when every loan type has zero overdue', () => {
    const result = auditLoanTypeOverdue(
      bureauWithTradelines([
        {
          accountTypeSymbol: '05',
          tradelines: [{ creditorName: 'HDFC', GrantedTrade: { amountPastDue: '0' } }],
        },
        {
          accountTypeSymbol: '10',
          tradelines: [{ creditorName: 'SBI Card', GrantedTrade: { amountPastDue: '-1' } }],
        },
      ]),
      0,
    );
    assert.equal(result.passed, true);
    assert.equal(result.detail, null);
    assert.equal(result.findings.length, 0);
  });

  it('rejects when any loan type overdue is greater than 0', () => {
    const result = auditLoanTypeOverdue(
      bureauWithTradelines([
        {
          accountTypeSymbol: '05',
          tradelines: [
            { creditorName: 'HDFC', accountNumber: 'PL-1', GrantedTrade: { amountPastDue: '1500' } },
          ],
        },
      ]),
      0,
    );
    assert.equal(result.passed, false);
    assert.match(result.detail ?? '', /Personal loan 1500 INR/);
    assert.equal(result.findings[0]?.data?.overdueAmountInr, 1500);
  });

  it('sums overdue within the same loan type', () => {
    const result = auditLoanTypeOverdue(
      bureauWithTradelines([
        {
          accountTypeSymbol: '05',
          tradelines: [
            { creditorName: 'HDFC', GrantedTrade: { amountPastDue: '400' } },
            { creditorName: 'ICICI', GrantedTrade: { amountPastDue: '700' } },
          ],
        },
      ]),
      1000,
    );
    assert.equal(result.passed, false);
    assert.equal(result.findings[0]?.data?.overdueAmountInr, 1100);
  });

  it('does not fail a loan type whose overdue is within the threshold', () => {
    const result = auditLoanTypeOverdue(
      bureauWithTradelines([
        {
          accountTypeSymbol: '05',
          tradelines: [{ creditorName: 'HDFC', GrantedTrade: { amountPastDue: '500' } }],
        },
        {
          accountTypeSymbol: '10',
          tradelines: [{ creditorName: 'SBI Card', GrantedTrade: { amountPastDue: '0' } }],
        },
      ]),
      500,
    );
    assert.equal(result.passed, true);
  });
});

describe('auditNoRestructuredLoans vs suit-filed AccountCondition', () => {
  it('does not treat Tenacio Tag 34 AccountCondition 01 as a restructure', () => {
    const result = auditNoRestructuredLoans(
      bureauWithTradelines([
        {
          accountTypeSymbol: '51',
          tradelines: [
            {
              creditorName: 'CENTRAL BANK',
              accountNumber: '00000003016839118',
              AccountCondition: {
                rank: '100000',
                symbol: '01',
                description: '',
                abbreviation: 'suitFiledStatus',
              },
            },
          ],
        },
      ]),
    );
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it('still flags unlabeled AccountCondition 01 as Tag 33 restructure', () => {
    const result = auditNoRestructuredLoans(
      bureauWithTradelines([
        {
          accountTypeSymbol: '51',
          tradelines: [
            {
              creditorName: 'CENTRAL BANK',
              AccountCondition: { symbol: '01' },
            },
          ],
        },
      ]),
    );
    assert.equal(result.passed, false);
    assert.match(result.findings[0]?.detail ?? '', /Restructured Loan \(Govt\. Mandated\)/);
  });

  it('reads suitFiledStatus AccountCondition as Suit filed', () => {
    const label = formatSuitFiledWilfulDefaultLabel({
      AccountCondition: {
        symbol: '01',
        abbreviation: 'suitFiledStatus',
      },
    });
    assert.equal(label, 'Suit filed');
  });

  it('does not treat a missing SuitFiled node as No suit filed', () => {
    const label = formatSuitFiledWilfulDefaultLabel({
      SuitFiled: undefined,
      AccountCondition: {
        symbol: '01',
        abbreviation: 'suitFiledStatus',
      },
    });
    assert.equal(label, 'Suit filed');
  });
});

describe('auditNoRestructuredLoans vs CreditFacilityStatus', () => {
  it('flags COVID / moratorium CreditFacilityStatus as a regulatory restructure', () => {
    const covid = auditNoRestructuredLoans(
      bureauWithTradelines([
        {
          accountTypeSymbol: '05',
          tradelines: [
            {
              creditorName: 'HOME CREDIT',
              accountNumber: '3911701697',
              CreditFacilityStatus: 'Restructured due to COVID-19',
            },
          ],
        },
      ]),
    );
    assert.equal(covid.passed, false);
    assert.match(covid.findings[0]?.detail ?? '', /Restructured due to COVID-19/);

    const moratorium = auditNoRestructuredLoans(
      bureauWithTradelines([
        {
          accountTypeSymbol: '05',
          tradelines: [
            {
              creditorName: 'HOME CREDIT',
              CreditFacilityStatus: 'Moratorium (Regulatory Measure)',
            },
          ],
        },
      ]),
    );
    assert.equal(moratorium.passed, false);
    assert.match(moratorium.findings[0]?.detail ?? '', /Moratorium \(Regulatory Measure\)/);
  });
});
