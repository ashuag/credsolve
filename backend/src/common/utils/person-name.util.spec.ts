import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatBureauInquiryName } from './person-name.util';

describe('formatBureauInquiryName', () => {
  it('duplicates a single-token name as first and last for CIBIL', () => {
    assert.equal(formatBureauInquiryName('KRISHNALAL'), 'KRISHNALAL KRISHNALAL');
    assert.equal(formatBureauInquiryName('  krishnalal  '), 'krishnalal krishnalal');
  });

  it('leaves names that already have a last name unchanged', () => {
    assert.equal(formatBureauInquiryName('SAURABH AGARWAL'), 'SAURABH AGARWAL');
    assert.equal(formatBureauInquiryName('Saurabh Kumar Agarwal'), 'Saurabh Kumar Agarwal');
  });

  it('collapses extra whitespace without duplicating', () => {
    assert.equal(formatBureauInquiryName('  SAURABH   AGARWAL '), 'SAURABH AGARWAL');
  });

  it('returns empty for blank input', () => {
    assert.equal(formatBureauInquiryName(''), '');
    assert.equal(formatBureauInquiryName('   '), '');
  });
});
