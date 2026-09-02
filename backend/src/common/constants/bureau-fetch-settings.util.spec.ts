import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBureauFetchDaysLimit } from './bureau-fetch-settings.util';

describe('parseBureauFetchDaysLimit', () => {
  it('defaults to 7 for empty or invalid values', () => {
    assert.equal(parseBureauFetchDaysLimit(undefined), 7);
    assert.equal(parseBureauFetchDaysLimit(''), 7);
    assert.equal(parseBureauFetchDaysLimit('abc'), 7);
    assert.equal(parseBureauFetchDaysLimit('-1'), 7);
  });

  it('accepts 0 (always fetch) and caps at 365', () => {
    assert.equal(parseBureauFetchDaysLimit('0'), 0);
    assert.equal(parseBureauFetchDaysLimit('7'), 7);
    assert.equal(parseBureauFetchDaysLimit('400'), 365);
  });
});
