import {
  buildDisbursementUniqueRequestNumber,
  isEasebuzzDuplicateUniqueRequestNumber,
  isEasebuzzFailedVendorStatus,
  parseEasebuzzQuickTransferInitiate,
  uniqueRequestNumberFromVendorPayload,
} from './easebuzz-transfer-log.util';

const insufficientFundsPayload = {
  data: {
    transfer_request: {
      id: 'tr82dc008140e245',
      amount: 22920,
      status: 'failure',
      currency: 'INR',
      narration: 'loan disbursed',
      failure_reason: 'CLEARED BAL/FUNDS/DP NOT AVAILABLE.CARE! ACCT WILL BE OVERDRAWN',
      payment_mode: 'IMPS',
      unique_request_number: 'MCASHAPP2026TSVP8',
      unique_transaction_reference: null,
    },
  },
  success: true,
};

describe('parseEasebuzzQuickTransferInitiate', () => {
  it('does not treat envelope success:true as a payout when transfer_request.status is failure', () => {
    const parsed = parseEasebuzzQuickTransferInitiate(insufficientFundsPayload);
    expect(parsed.accepted).toBe(false);
    expect(parsed.vendorStatus).toBe('failure');
    expect(parsed.message).toContain('CLEARED BAL/FUNDS/DP NOT AVAILABLE');
  });

  it('accepts a pending or success transfer even when the envelope is success:true', () => {
    expect(
      parseEasebuzzQuickTransferInitiate({
        success: true,
        data: { transfer_request: { status: 'pending', unique_transaction_reference: 'UTR1' } },
      }).accepted,
    ).toBe(true);
    expect(
      parseEasebuzzQuickTransferInitiate({
        success: true,
        data: { transfer_request: { status: 'success', unique_transaction_reference: 'UTR2' } },
      }).accepted,
    ).toBe(true);
  });

  it('rejects envelope success:true when only a failure_reason is present', () => {
    const parsed = parseEasebuzzQuickTransferInitiate({
      success: true,
      data: { transfer_request: { failure_reason: 'Insufficient funds' } },
    });
    expect(parsed.accepted).toBe(false);
    expect(parsed.message).toBe('Insufficient funds');
  });

  it('treats a duplicate unique request number as a rejected initiate', () => {
    const parsed = parseEasebuzzQuickTransferInitiate({
      success: false,
      message: 'Request already exists with same Unique Request Number.',
      error_code: null,
    });
    expect(parsed.accepted).toBe(false);
    expect(isEasebuzzDuplicateUniqueRequestNumber(parsed.message)).toBe(true);
  });
});

describe('buildDisbursementUniqueRequestNumber', () => {
  it('concatenates the application number with the current timestamp', () => {
    expect(buildDisbursementUniqueRequestNumber('APP2026TSVP8', 1756535907000)).toBe(
      'APP2026TSVP81756535907000',
    );
  });

  it('strips non-alphanumeric characters and stays within 40 chars', () => {
    const urn = buildDisbursementUniqueRequestNumber('app-2026-tsvp8', 1_756_535_907_000);
    expect(urn).toBe('APP2026TSVP81756535907000');
    expect(urn.length).toBeLessThanOrEqual(40);
  });
});

describe('isEasebuzzFailedVendorStatus', () => {
  it('recognizes vendor failure statuses', () => {
    expect(isEasebuzzFailedVendorStatus('failure')).toBe(true);
    expect(isEasebuzzFailedVendorStatus('pending')).toBe(false);
    expect(isEasebuzzFailedVendorStatus(null)).toBe(false);
  });
});

describe('uniqueRequestNumberFromVendorPayload', () => {
  it('reads unique_request_number from the vendor request body', () => {
    expect(
      uniqueRequestNumberFromVendorPayload({
        unique_request_number: 'APP2026TSVP81756535907000',
        account_number: '1234562868',
      }),
    ).toBe('APP2026TSVP81756535907000');
  });
});
