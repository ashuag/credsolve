import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  remainingDueInr,
  resolveRequestedPayAmount,
  shouldCloseLoanAfterPayment,
  sumRepaymentAmounts,
} from './loan-repayment-outstanding.util';
import { parseMinPayAmountInr } from './min-pay-amount.util';

describe('loan-repayment-outstanding', () => {
  it('subtracts successful payments from the current bill', () => {
    assert.equal(remainingDueInr(16200, 5000), 11200);
    assert.equal(remainingDueInr(100, 100), 0);
    assert.equal(remainingDueInr(100, 150), 0);
  });

  it('treats omitted amount as full remaining', () => {
    assert.deepEqual(
      resolveRequestedPayAmount({ requestedAmountInr: null, remainingInr: 16200, minPayAmountInr: 100 }),
      { amountInr: 16200, isFullPayoff: true },
    );
  });

  it('treats an amount equal to remaining as full payoff', () => {
    assert.deepEqual(
      resolveRequestedPayAmount({ requestedAmountInr: 16200, remainingInr: 16200, minPayAmountInr: 100 }),
      { amountInr: 16200, isFullPayoff: true },
    );
  });

  it('accepts a partial at or above the minimum', () => {
    assert.deepEqual(
      resolveRequestedPayAmount({ requestedAmountInr: 100, remainingInr: 16200, minPayAmountInr: 100 }),
      { amountInr: 100, isFullPayoff: false },
    );
    assert.deepEqual(
      resolveRequestedPayAmount({ requestedAmountInr: 5000, remainingInr: 16200, minPayAmountInr: 100 }),
      { amountInr: 5000, isFullPayoff: false },
    );
  });

  it('rejects a partial below the minimum', () => {
    const result = resolveRequestedPayAmount({
      requestedAmountInr: 50,
      remainingInr: 16200,
      minPayAmountInr: 100,
    });
    assert.equal('error' in result, true);
  });

  it('rejects a partial when remaining is below the minimum — full remaining only', () => {
    const result = resolveRequestedPayAmount({
      requestedAmountInr: 80,
      remainingInr: 80,
      minPayAmountInr: 100,
    });
    assert.deepEqual(result, { amountInr: 80, isFullPayoff: true });

    const tooSmallPartial = resolveRequestedPayAmount({
      requestedAmountInr: 40,
      remainingInr: 80,
      minPayAmountInr: 100,
    });
    assert.equal('error' in tooSmallPartial, true);
  });

  it('closes only when remaining after payment is effectively zero', () => {
    assert.equal(shouldCloseLoanAfterPayment(0), true);
    assert.equal(shouldCloseLoanAfterPayment(0.009), true);
    assert.equal(shouldCloseLoanAfterPayment(0.02), false);
    assert.equal(shouldCloseLoanAfterPayment(100), false);
  });

  it('sums SUCCESS repayment rows only', () => {
    assert.equal(
      sumRepaymentAmounts([
        { amount: '5000.00', status: 'SUCCESS' },
        { amount: '100.00', status: 'FAILED' },
        { amount: 2000, status: 'SUCCESS' },
      ]),
      7000,
    );
  });
});

describe('parseMinPayAmountInr', () => {
  it('parses a valid INR amount', () => {
    assert.equal(parseMinPayAmountInr('250'), 250);
    assert.equal(parseMinPayAmountInr('100.50'), 100.5);
  });

  it('falls back to the setting default for invalid values', () => {
    assert.equal(parseMinPayAmountInr(''), 100);
    assert.equal(parseMinPayAmountInr('-1'), 100);
    assert.equal(parseMinPayAmountInr(null), 100);
  });
});
