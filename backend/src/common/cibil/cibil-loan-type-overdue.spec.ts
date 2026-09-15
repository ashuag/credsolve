import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { auditLoanTypeOverdue } from './cibil-bureau-rules.parser';

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
