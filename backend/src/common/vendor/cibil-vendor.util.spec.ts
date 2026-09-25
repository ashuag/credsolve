import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  inferCibilVendorFromPayload,
  mapCibilVendorName,
  resolveCibilVendorDisplayName,
} from './cibil-vendor.util';

describe('cibil-vendor.util', () => {
  it('maps vendor_api_config names onto supported integrations', () => {
    assert.equal(mapCibilVendorName('Surepass'), 'surepass');
    assert.equal(mapCibilVendorName('CIBIL07'), 'cibil07');
    assert.equal(mapCibilVendorName('CIBIL 07'), 'cibil07');
    assert.equal(mapCibilVendorName('MyMoneyBazaar'), 'cibil07');
    assert.equal(mapCibilVendorName('My Money Bazaar'), 'cibil07');
    assert.equal(mapCibilVendorName('PayMe India'), 'cibil07');
    assert.equal(mapCibilVendorName('Tenacio'), 'tenacio');
  });

  it('infers Surepass / CIBIL07 from stamped sourceVendor', () => {
    assert.equal(inferCibilVendorFromPayload({ sourceVendor: 'Surepass' }), 'surepass');
    assert.equal(inferCibilVendorFromPayload({ sourceVendor: 'CIBIL07' }), 'cibil07');
    assert.equal(inferCibilVendorFromPayload({ sourceVendor: 'MyMoneyBazaar' }), 'cibil07');
    assert.equal(inferCibilVendorFromPayload({ status: 'success' }), 'tenacio');
    assert.equal(inferCibilVendorFromPayload(null), 'tenacio');
  });

  it('prefers a stored vendor name over payload inference', () => {
    assert.equal(
      resolveCibilVendorDisplayName({
        storedVendorName: 'Surepass',
        vendorBody: { sourceVendor: 'Tenacio' },
      }),
      'Surepass',
    );
    assert.equal(
      resolveCibilVendorDisplayName({
        vendorKind: 'cibil07',
      }),
      'CIBIL07',
    );
    assert.equal(
      resolveCibilVendorDisplayName({
        vendorBody: { sourceVendor: 'Surepass' },
      }),
      'Surepass',
    );
  });
});
