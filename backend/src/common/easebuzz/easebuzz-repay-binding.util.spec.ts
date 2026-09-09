import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkEasyCollectLoanBinding,
  easebuzzRepayLoanLookupKeys,
  isEasyCollectWebhookPayload,
  parseEasebuzzAddedOn,
} from './easebuzz-repay-binding.util';

const LOAN_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const APP_UUID = '11111111-2222-3333-4444-555555555555';
const LOAN_NUMBER = 'APP20262BRQJ';

const loan = {
  uuid: LOAN_UUID,
  loanNumber: LOAN_NUMBER,
  application: { uuid: APP_UUID },
};

describe('easebuzzRepayLoanLookupKeys', () => {
  it('reads Pay Now udf1 as a loan UUID', () => {
    const keys = easebuzzRepayLoanLookupKeys({ udf1: LOAN_UUID, txnid: `${LOAN_NUMBER}1757311338000` }, null);
    assert.deepEqual(keys.uuids, [LOAN_UUID]);
    assert.deepEqual(keys.publicIds, []);
  });

  it('reads EasyCollect udf1/txnid as the public loan number', () => {
    const keys = easebuzzRepayLoanLookupKeys(
      { udf1: LOAN_NUMBER, txnid: LOAN_NUMBER, udf2: 'Due 10-09-2026', udf3: '30000' },
      null,
    );
    assert.deepEqual(keys.uuids, []);
    assert.deepEqual(keys.publicIds, [LOAN_NUMBER]);
  });
});

describe('isEasyCollectWebhookPayload', () => {
  it('detects EasyCollect productinfo and easy_collect surl/furl', () => {
    assert.equal(
      isEasyCollectWebhookPayload({
        txnid: LOAN_NUMBER,
        udf1: LOAN_NUMBER,
        productinfo: 'EasyCollect Payment',
        surl: 'https://pay.easebuzz.in/easy_collect/surl/abc',
        furl: 'https://pay.easebuzz.in/easy_collect/furl/abc',
      }),
      true,
    );
  });

  it('does not treat in-app Pay Now (UUID udf1 + timestamp txnid) as EasyCollect', () => {
    assert.equal(
      isEasyCollectWebhookPayload({
        txnid: `${LOAN_NUMBER}1757311338000`,
        udf1: LOAN_UUID,
        udf2: APP_UUID,
        udf3: LOAN_NUMBER,
        productinfo: `Loan repay ${LOAN_NUMBER}`,
      }),
      false,
    );
  });
});

describe('checkEasyCollectLoanBinding', () => {
  it('accepts EasyCollect UDFs that use the application number and due-date text', () => {
    assert.equal(
      checkEasyCollectLoanBinding(
        {
          udf1: LOAN_NUMBER,
          udf2: 'Due 10-09-2026',
          udf3: '30000',
          udf4: '22D',
          udf5: 'Pending',
          txnid: LOAN_NUMBER,
        },
        loan,
        null,
      ),
      null,
    );
  });

  it('rejects a public id that belongs to a different loan', () => {
    assert.equal(
      checkEasyCollectLoanBinding(
        { udf1: 'APP2026XXXXX', txnid: 'APP2026XXXXX' },
        loan,
        null,
      ),
      'udf_loan_mismatch',
    );
  });
});

describe('parseEasebuzzAddedOn', () => {
  it('parses Easebuzz addedon timestamps', () => {
    const parsed = parseEasebuzzAddedOn('2026-09-08 06:02:18.000000');
    assert.ok(parsed instanceof Date);
    assert.equal(Number.isNaN(parsed.getTime()), false);
  });
});
