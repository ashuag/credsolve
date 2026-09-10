import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapMyMoneyBazaarSoftPullToTenacioEnvelope } from './mymoneybazaar-cibil-to-tenacio.mapper';

const bureauReport = {
  GetCustomerAssetsResponse: {
    ResponseStatus: 'Success',
    GetCustomerAssetsSuccess: {
      Asset: {
        TrueLinkCreditReport: {
          Borrower: { CreditScore: { riskScore: '742' } },
        },
      },
    },
  },
};

/** A successful soft-pull envelope from mymoneybazaarApi `/api/cibil/soft-pull`. */
function softPullOk(data: unknown) {
  return {
    success: true,
    request_uuid: 'req-uuid-1',
    status: 'SUCCESS',
    http_status: 200,
    data,
  };
}

describe('mapMyMoneyBazaarSoftPullToTenacioEnvelope', () => {
  it('wraps a PayMe India merchant report into the Tenacio envelope', () => {
    const wrapped = mapMyMoneyBazaarSoftPullToTenacioEnvelope(
      softPullOk({
        status: true,
        data: { cibilData: bureauReport, html_url: 'https://x/report.html' },
      }),
      200,
    );

    assert.equal(wrapped.status, 'success');
    assert.equal(wrapped.serviceStatusCode, 200);
    assert.deepEqual(wrapped.data?.cibilData, bureauReport);
    assert.equal(wrapped.data?.htmlUrl, 'https://x/report.html');
    assert.equal(wrapped.requestId, 'req-uuid-1');
  });

  it('maps a merchant no-hit to the Tenacio 422 error envelope', () => {
    const wrapped = mapMyMoneyBazaarSoftPullToTenacioEnvelope(
      softPullOk({ status: false, message: 'No matching bureau record' }),
      200,
    );
    assert.deepEqual(wrapped, {
      status: 'error',
      serviceStatusCode: 422,
      requestId: 'req-uuid-1',
      serviceError: { message: 'No matching bureau record' },
    });
  });

  it('passes through a payload that is already a Tenacio envelope', () => {
    const wrapped = mapMyMoneyBazaarSoftPullToTenacioEnvelope(
      softPullOk({
        status: 'success',
        serviceStatusCode: 200,
        requestId: 'tnc-1',
        data: { htmlUrl: null, cibilData: bureauReport },
      }),
      200,
    );
    assert.equal(wrapped.status, 'success');
    assert.deepEqual(wrapped.data?.cibilData, bureauReport);
    assert.equal(wrapped.requestId, 'tnc-1');
  });

  it('surfaces a soft-pull transport failure as a Tenacio error envelope', () => {
    const wrapped = mapMyMoneyBazaarSoftPullToTenacioEnvelope(
      {
        success: false,
        request_uuid: 'req-uuid-2',
        status: 'VENDOR_ERROR',
        http_status: 502,
        data: null,
        error: { code: 'VENDOR_ERROR', message: 'Vendor responded HTTP 502' },
      },
      502,
    );
    assert.equal(wrapped.status, 'error');
    assert.equal(wrapped.serviceStatusCode, 502);
    assert.equal(wrapped.serviceError?.message, 'Vendor responded HTTP 502');
  });

  it('surfaces a timeout as serviceStatusCode 504', () => {
    const wrapped = mapMyMoneyBazaarSoftPullToTenacioEnvelope(
      { success: false, status: 'TIMEOUT', http_status: null, data: null },
      504,
    );
    assert.equal(wrapped.status, 'error');
    assert.equal(wrapped.serviceStatusCode, 504);
  });

  it('handles a missing / non-object body', () => {
    const wrapped = mapMyMoneyBazaarSoftPullToTenacioEnvelope(null, 500);
    assert.equal(wrapped.status, 'error');
    assert.equal(wrapped.serviceStatusCode, 500);
  });
});
