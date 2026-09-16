import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractPanNsdlSnapshot } from './pan-nsdl-snapshot.util';

describe('extractPanNsdlSnapshot', () => {
  it('prefers the latest vendor log over the cache row', () => {
    const snapshot = extractPanNsdlSnapshot({
      requestPayload: { input: { panNumber: 'ABCDE1234F', name: 'Saurabh Agarwal' } },
      responsePayload: {
        status: 'success',
        data: { panNumber: 'ABCDE1234F', panStatus: 'valid', nameMatch: false, dobMatch: true },
      },
      cache: {
        panNumber: 'ABCDE1234F',
        fullName: 'SAURABH AGARWAL',
        nameVerified: true,
        nsdlResponse: { data: { nameMatch: true, dobMatch: true, panStatus: 'valid' } },
      },
    });

    assert.deepEqual(snapshot, {
      fullName: 'SAURABH AGARWAL',
      panNumber: 'ABCDE1234F',
      nameMatch: false,
      dobMatch: true,
      panStatus: 'valid',
    });
  });

  it('falls back to the PAN NSDL cache when no vendor log exists', () => {
    const snapshot = extractPanNsdlSnapshot({
      cache: {
        panNumber: 'ABCDE1234F',
        fullName: 'Anusha Gupta',
        nameVerified: false,
        nsdlResponse: {
          data: { panNumber: 'ABCDE1234F', panStatus: 'valid', nameMatch: false, dobMatch: true },
        },
      },
    });

    assert.equal(snapshot?.fullName, 'ANUSHA GUPTA');
    assert.equal(snapshot?.panNumber, 'ABCDE1234F');
    assert.equal(snapshot?.nameMatch, false);
    assert.equal(snapshot?.dobMatch, true);
  });

  it('reads snake_case match flags from the vendor payload', () => {
    const snapshot = extractPanNsdlSnapshot({
      responsePayload: {
        data: { pan_status: 'invalid', name_matched: false, dob_matched: true },
      },
    });

    assert.equal(snapshot?.nameMatch, false);
    assert.equal(snapshot?.dobMatch, true);
    assert.equal(snapshot?.panStatus, 'invalid');
  });
});
