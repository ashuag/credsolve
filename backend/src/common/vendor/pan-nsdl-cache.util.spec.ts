import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isPanAndDobVerifiedForCache,
  normalizePanNsdlCacheIdentity,
  panNsdlIdentitiesEqual,
} from './pan-nsdl-cache.util';

describe('pan-nsdl-cache.util', () => {
  it('uppercases PAN and name and strips time from DOB', () => {
    const key = normalizePanNsdlCacheIdentity({
      panNumber: ' abcde1234f ',
      fullName: 'Ramesh Verma',
      dateOfBirth: new Date('1990-05-12T18:30:00.000Z'),
    });
    assert.equal(key.panNumber, 'ABCDE1234F');
    assert.equal(key.fullName, 'RAMESH VERMA');
    assert.equal(key.dateOfBirth.toISOString(), '1990-05-12T00:00:00.000Z');
  });

  it('inserts only when PAN is valid and DOB matches', () => {
    assert.equal(isPanAndDobVerifiedForCache({ panStatus: 'valid', dobMatch: true }), true);
    assert.equal(isPanAndDobVerifiedForCache({ panStatus: 'valid', dobMatch: false }), false);
    assert.equal(isPanAndDobVerifiedForCache({ panStatus: 'invalid', dobMatch: true }), false);
    assert.equal(isPanAndDobVerifiedForCache({ panStatus: null, dobMatch: true }), false);
  });

  it('treats mixed-case names as the same identity', () => {
    assert.equal(
      panNsdlIdentitiesEqual(
        {
          panNumber: 'ABCDE1234F',
          fullName: 'Ramesh Verma',
          dateOfBirth: new Date(Date.UTC(1990, 4, 12)),
        },
        {
          panNumber: 'abcde1234f',
          fullName: 'RAMESH VERMA',
          dateOfBirth: new Date(Date.UTC(1990, 4, 12, 8)),
        },
      ),
      true,
    );
  });
});
