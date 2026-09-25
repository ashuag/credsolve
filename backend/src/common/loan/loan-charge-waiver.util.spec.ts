import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appliedChargeWaiverInr,
  billDueNowAfterWaiverInr,
  negotiableOverdueChargesInr,
} from './loan-charge-waiver.util';

describe('loan-charge-waiver', () => {
  it('caps the waiver at penal + overdue-days interest', () => {
    assert.equal(negotiableOverdueChargesInr(400, 600), 1000);
    assert.equal(appliedChargeWaiverInr(1000, 1500), 1000);
    assert.equal(appliedChargeWaiverInr(1000, 500), 500);
    assert.equal(appliedChargeWaiverInr(1000, 0), 0);
  });

  it('reduces the live bill by the waived portion of X+Y only', () => {
    // P 10000 + Z 800 + Y 600 = 11400 before penal; X 400; waive 500 of X+Y.
    const result = billDueNowAfterWaiverInr({
      amountDueBeforePenal: 11_400,
      penalInr: 400,
      overdueInterestInr: 600,
      waivedAmountInr: 500,
    });
    assert.equal(result.negotiableInr, 1000);
    assert.equal(result.appliedWaiverInr, 500);
    assert.equal(result.remainingNegotiableInr, 500);
    assert.equal(result.billDueNow, 11_300);
  });

  it('lets a full X+Y waiver leave principal + tenure interest', () => {
    const result = billDueNowAfterWaiverInr({
      amountDueBeforePenal: 10_800,
      penalInr: 400,
      overdueInterestInr: 600,
      waivedAmountInr: 1000,
    });
    assert.equal(result.billDueNow, 10_800);
    assert.equal(result.appliedWaiverInr, 1000);
  });
});
