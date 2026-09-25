import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractCibilReportData } from './cibil-report-data.extractor';

function wrapTrueLink(tlr: Record<string, unknown>) {
  return {
    data: {
      cibilData: {
        GetCustomerAssetsResponse: {
          GetCustomerAssetsSuccess: {
            Asset: { TrueLinkCreditReport: tlr },
          },
        },
      },
    },
  };
}

describe('extractCibilReportData enquiries', () => {
  it('shows member name and TUEF loan-type label from InquiryPartition', () => {
    const report = extractCibilReportData(
      wrapTrueLink({
        InquiryPartition: [
          {
            Inquiry: {
              inquiryDate: '2024-07-31',
              inquiryType: '05',
              subscriberName: 'HDFC BANK',
              amount: '10000',
            },
          },
          {
            Inquiry: {
              inquiryDate: '2024-08-01',
              inquiryType: '69',
              subscriberName: 'KRAZYBEE',
              amount: '7600',
            },
          },
        ],
      }),
    );
    assert.equal(report.inquiries.length, 2);
    assert.deepEqual(
      report.inquiries.map((row) => [row.member, row.purpose]),
      [
        ['KRAZYBEE', 'Short Term Personal Loan'],
        ['HDFC BANK', 'Personal Loan'],
      ],
    );
  });

  it('does not label a missing purpose as Other', () => {
    const report = extractCibilReportData(
      wrapTrueLink({
        InquiryPartition: [
          {
            Inquiry: {
              inquiryDate: '2024-07-31',
              amount: '10000',
            },
          },
        ],
      }),
    );
    assert.equal(report.inquiries[0]?.member, 'Enquirer');
    assert.equal(report.inquiries[0]?.purpose, '-');
  });

  it('fills member and purpose from OriginalData when InquiryPartition omits them', () => {
    const tuef = {
      ICRS_SubjectInquiryByTUEF_Response: {
        subject: [
          {
            inquiry: [
              {
                enqControlNum: '819232262',
                dateOfInquiry: '2024-07-31',
                inquiryPurpose: '05',
                memberShortName: 'HDFC BANK',
                inquiryAmount: '10000',
              },
            ],
          },
        ],
      },
    };
    const report = extractCibilReportData(
      wrapTrueLink({
        Sources: { Source: { OriginalData: Buffer.from(JSON.stringify(tuef)).toString('base64') } },
        InquiryPartition: [
          {
            Inquiry: {
              enqControlNum: '819232262',
              inquiryDate: '2024-07-31',
              amount: '10000',
            },
          },
        ],
      }),
    );
    assert.equal(report.inquiries[0]?.member, 'HDFC BANK');
    assert.equal(report.inquiries[0]?.purpose, 'Personal Loan');
  });

  it('replaces underscores and title-cases enquiry purpose text', () => {
    const report = extractCibilReportData(
      wrapTrueLink({
        InquiryPartition: [
          {
            Inquiry: {
              inquiryDate: '2024-07-31',
              inquiryType: 'PERSONAL_LOAN',
              subscriberName: 'HDFC BANK',
              amount: '10000',
            },
          },
        ],
      }),
    );
    assert.equal(report.inquiries[0]?.purpose, 'Personal Loan');
  });

  it('maps (BLPS-AGR) loan types to Business Loan - Priority Sector - Agriculture', () => {
    const report = extractCibilReportData(
      wrapTrueLink({
        TradeLinePartition: [
          {
            Tradeline: {
              creditorName: 'NABARD',
              accountTypeDescription: '(BLPS-AGR) Business Loan - Priority Sector - Agriculture',
              dateOpened: '2024-01-01',
              currentBalance: '0',
            },
          },
        ],
        InquiryPartition: [
          {
            Inquiry: {
              inquiryDate: '2024-07-31',
              inquiryType: '(BLPS-AGR) Business Loan - Priority Sector - Agriculture',
              subscriberName: 'NABARD',
              amount: '50000',
            },
          },
        ],
      }),
    );
    assert.equal(report.accounts[0]?.accountType, 'Business Loan - Priority Sector - Agriculture');
    assert.equal(report.inquiries[0]?.purpose, 'Business Loan - Priority Sector - Agriculture');
  });
});

describe('extractCibilReportData suit filed vs restructure', () => {
  it('shows Suit filed from Tenacio AccountCondition and does not invent a restructure', () => {
    const report = extractCibilReportData(
      wrapTrueLink({
        TradeLinePartition: [
          {
            accountTypeSymbol: '51',
            Tradeline: {
              creditorName: 'CENTRAL BANK',
              accountNumber: '00000003016839118',
              dateOpened: '2008-03-12',
              dateClosed: '2022-03-30',
              currentBalance: '0',
              AccountCondition: {
                rank: '100000',
                symbol: '01',
                description: '',
                abbreviation: 'suitFiledStatus',
              },
            },
          },
        ],
      }),
    );
    assert.equal(report.accounts[0]?.suitFiled, 'Suit filed');
    assert.deepEqual(report.assessmentInsights.restructuredLoans, []);
  });
});
