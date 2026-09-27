import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { CredostackIfscService } from './credostack-ifsc.service';

describe('CredostackIfscService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CREDOSTACK_URL = 'https://api.credsolve.in';
    process.env.CREDOSTACK_CLIENT_CODE = 'money-cash';
    process.env.CREDOSTACK_API_KEY = 'secret-key';
    delete process.env.CREDOSTACK_IFSC_PATH;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('skips the vendor when Credostack env is missing', async () => {
    delete process.env.CREDOSTACK_API_KEY;
    let called = false;
    const service = new CredostackIfscService({
      request: async () => {
        called = true;
        return { ok: true, httpStatus: 200, body: null };
      },
    } as never);

    const out = await service.lookupIfsc('HDFC0001234', 7n);

    assert.equal(called, false);
    assert.equal(out.configured, false);
    assert.equal(out.ok, false);
    assert.match(out.skipReason ?? '', /CREDOSTACK_API_KEY/);
  });

  it('GETs /ifsc/{code} and marks the client code and api key as sensitive', async () => {
    let received: Record<string, unknown> | null = null;
    const service = new CredostackIfscService({
      request: async (args: Record<string, unknown>) => {
        received = args;
        return {
          ok: true,
          httpStatus: 200,
          body: { data: { bank: 'HDFC Bank', ifsc: 'HDFC0001234' } },
        };
      },
    } as never);

    const out = await service.lookupIfsc('HDFC0001234', 7n);

    assert.equal(out.ok, true);
    assert.equal(out.configured, true);
    assert.ok(received);
    assert.equal(received.providerName, 'Credostack');
    assert.equal(received.serviceName, 'ifsc-lookup');
    assert.equal(received.method, 'GET');
    assert.equal(received.baseUrl, 'https://api.credsolve.in');
    assert.equal(received.path, 'ifsc/HDFC0001234');
    assert.equal(received.leadId, 7n);
    assert.deepEqual(received.headers, {
      'X-Client-Code': 'money-cash',
      'X-Api-Key': 'secret-key',
    });
    assert.deepEqual(received.sensitiveHeaderNames, ['x-api-key', 'x-client-code']);
  });
});
