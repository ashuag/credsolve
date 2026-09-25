import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LookupIfscUseCase } from './lookup-ifsc.use-case';

/** Shape Credostack returns for GET /ifsc/{code}: Tenacio envelope with `data.bank`. */
const TENACIO_IFSC_BODY = {
  status: 'success',
  data: {
    ifsc: 'HDFC0001234',
    bank: 'HDFC Bank',
    branch: 'Andheri East',
    address: '123 Link Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400069',
  },
};

function makeUseCase(vendorBody: unknown, ok = true) {
  const upserts: unknown[] = [];
  const useCase = new LookupIfscUseCase(
    {
      lookupIfsc: async () => ({
        configured: true,
        ok,
        httpStatus: ok ? 200 : 404,
        vendorBody,
      }),
    } as never,
    { findByUuid: async () => null } as never,
    {
      findByIfscCode: async () => null,
      upsertFromLookup: async (fields: unknown) => {
        upserts.push(fields);
      },
    } as never,
    { findActiveSummaryForCustomer: async () => null } as never,
  );
  return { useCase, upserts };
}

const req = {} as never;
const dto = { ifscNumber: 'HDFC0001234' };

describe('LookupIfscUseCase', () => {
  it('persists a Credostack IFSC body that includes a bank name', async () => {
    const { useCase, upserts } = makeUseCase(TENACIO_IFSC_BODY);
    const out = await useCase.execute(req, dto);

    assert.equal(out.ok, true);
    assert.equal(out.details?.bankName, 'HDFC Bank');
    assert.equal(out.details?.branch, 'Andheri East');
    assert.equal(upserts.length, 1);
    assert.equal((upserts[0] as { bankName: string }).bankName, 'HDFC Bank');
  });

  it('reads a bank name one envelope deeper or from bank_name', async () => {
    const wrapped = { data: { data: { bank: 'State Bank of India', ifsc: 'SBIN0001234' } } };
    const snake = { data: { bank_name: 'ICICI Bank', ifsc_code: 'ICIC0001234' } };

    const wrappedOut = await makeUseCase(wrapped).useCase.execute(req, { ifscNumber: 'SBIN0001234' });
    const snakeOut = await makeUseCase(snake).useCase.execute(req, { ifscNumber: 'ICIC0001234' });

    assert.equal(wrappedOut.details?.bankName, 'State Bank of India');
    assert.equal(snakeOut.details?.bankName, 'ICICI Bank');
  });

  it('does not cache a 2xx body that has no bank name', async () => {
    const { useCase, upserts } = makeUseCase({
      status: 'success',
      data: { message: 'ok', ifsc: 'HDFC0001234' },
    });
    const out = await useCase.execute(req, dto);

    assert.equal(out.ok, false);
    assert.equal(out.details, null);
    assert.equal(upserts.length, 0);
  });
});
