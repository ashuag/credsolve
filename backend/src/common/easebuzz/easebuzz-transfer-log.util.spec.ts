import { parseEasebuzzQuickTransferInitiate } from './easebuzz-transfer-log.util';

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
});
