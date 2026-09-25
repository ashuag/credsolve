import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canReusePriorBureauReport,
  isBureauReportWithinDaysLimit,
} from './bureau-report-reuse.util';

const SUCCESS_PAYLOAD = { status: 'success', serviceStatusCode: 200, data: { cibilData: { ok: true } } };
const FAILED_PAYLOAD = { status: 'error', serviceStatusCode: 422, serviceError: { message: 'no hit' } };

describe('isBureauReportWithinDaysLimit', () => {
  const now = new Date('2026-09-02T12:00:00.000Z');

  it('reuses a report younger than the limit', () => {
    const createdAt = new Date('2026-08-27T12:00:00.000Z');
    assert.equal(isBureauReportWithinDaysLimit(createdAt, 7, now), true);
  });

  it('refetches a report that is exactly the limit age', () => {
    const createdAt = new Date('2026-08-26T12:00:00.000Z');
    assert.equal(isBureauReportWithinDaysLimit(createdAt, 7, now), false);
  });

  it('never reuses when the limit is 0', () => {
    const createdAt = new Date('2026-09-02T11:00:00.000Z');
    assert.equal(isBureauReportWithinDaysLimit(createdAt, 0, now), false);
  });
});

describe('canReusePriorBureauReport', () => {
  const now = new Date('2026-09-02T12:00:00.000Z');
  const fresh = new Date('2026-08-30T12:00:00.000Z');
  const stale = new Date('2026-08-20T12:00:00.000Z');

  it('reuses a fresh successful report (recurring or rejected reapply)', () => {
    assert.equal(
      canReusePriorBureauReport({
        daysLimit: 7,
        priorCreatedAt: fresh,
        priorPayload: SUCCESS_PAYLOAD,
        now,
      }),
      true,
    );
  });

  it('does not reuse when the customer has no prior report', () => {
    assert.equal(
      canReusePriorBureauReport({
        daysLimit: 7,
        priorCreatedAt: null,
        priorPayload: SUCCESS_PAYLOAD,
        now,
      }),
      false,
    );
  });

  it('does not reuse a stale or failed report', () => {
    assert.equal(
      canReusePriorBureauReport({
        daysLimit: 7,
        priorCreatedAt: stale,
        priorPayload: SUCCESS_PAYLOAD,
        now,
      }),
      false,
    );
    assert.equal(
      canReusePriorBureauReport({
        daysLimit: 7,
        priorCreatedAt: fresh,
        priorPayload: FAILED_PAYLOAD,
        now,
      }),
      false,
    );
  });
});
