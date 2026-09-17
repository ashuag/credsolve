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
    assert.equal(mapCibilVendorName('My Money Bazaar'), 'mymoneybazaar');
    assert.equal(mapCibilVendorName('PayMe India'), 'mymoneybazaar');
    assert.equal(mapCibilVendorName('Tenacio'), 'tenacio');
  });

  it('infers Surepass / MyMoneyBazaar from stamped sourceVendor', () => {
    assert.equal(inferCibilVendorFromPayload({ sourceVendor: 'Surepass' }), 'surepass');
    assert.equal(inferCibilVendorFromPayload({ sourceVendor: 'MyMoneyBazaar' }), 'mymoneybazaar');
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
        vendorKind: 'mymoneybazaar',
      }),
      'MyMoneyBazaar',
    );
    assert.equal(
      resolveCibilVendorDisplayName({
        vendorBody: { sourceVendor: 'Surepass' },
      }),
      'Surepass',
    );
  });
});
