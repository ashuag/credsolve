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
        ['HDFC BANK', 'Personal loan'],
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
    assert.equal(report.inquiries[0]?.purpose, 'Personal loan');
  });
});
