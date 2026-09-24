import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APPLICATION_STATUS } from '../../common/constants/application.constants';
import { LEAD_STATUS } from '../../common/constants/lead.constants';
import { canRecheckPennyDrop } from './penny-drop-grant-retry.util';

const base = {
  hasAccountToRecheck: true,
  bankVerified: false,
  nameMatchPendingReview: false,
  latestAttemptMatched: false as boolean | null,
  disbursed: false,
  applicationStatusCode: APPLICATION_STATUS.PENNYDROP_FAILED,
  leadStatusCode: LEAD_STATUS.CONVERTED,
};

describe('canRecheckPennyDrop', () => {
  it('allows a failed attempt that still has an account', () => {
    assert.equal(canRecheckPennyDrop(base), true);
  });

  it('allows a name-match hold even when the bank account was saved', () => {
    assert.equal(
      canRecheckPennyDrop({
        ...base,
        bankVerified: true,
        nameMatchPendingReview: true,
        latestAttemptMatched: false,
        applicationStatusCode: APPLICATION_STATUS.IN_REVIEW,
      }),
      true,
    );
  });

  it('hides the action after a matched account or a closed book', () => {
    assert.equal(
      canRecheckPennyDrop({
        ...base,
        bankVerified: true,
        latestAttemptMatched: true,
        applicationStatusCode: APPLICATION_STATUS.IN_REVIEW,
      }),
      false,
    );
    assert.equal(canRecheckPennyDrop({ ...base, disbursed: true }), false);
    assert.equal(
      canRecheckPennyDrop({ ...base, applicationStatusCode: APPLICATION_STATUS.REJECTED }),
      false,
    );
    assert.equal(canRecheckPennyDrop({ ...base, hasAccountToRecheck: false }), false);
  });
});
