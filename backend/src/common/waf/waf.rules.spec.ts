import {
  inspectRequestForWaf,
  isWafBlockMode,
  isWafEnabled,
} from './waf.rules';

describe('inspectRequestForWaf', () => {
  const base = {
    method: 'GET',
    headers: {},
  };

  it('allows a normal auth path', () => {
    expect(
      inspectRequestForWaf({
        ...base,
        originalUrl: '/api/auth/send-otp',
      }),
    ).toBeNull();
  });

  it('blocks path traversal in the URL', () => {
    const hit = inspectRequestForWaf({
      ...base,
      originalUrl: '/api/auth/../../etc/passwd',
    });
    expect(hit?.ruleId).toBe('path-traversal');
  });

  it('blocks SQL injection in the query string', () => {
    const hit = inspectRequestForWaf({
      ...base,
      originalUrl: "/api/auth/me?id=1'%20OR%20'1'%3D'1",
      queryString: "id=1'%20OR%20'1'%3D'1",
    });
    expect(hit?.ruleId).toBe('sql-injection');
  });

  it('blocks XSS in the URL', () => {
    const hit = inspectRequestForWaf({
      ...base,
      originalUrl: '/api/auth/me?q=%3Cscript%3Ealert(1)%3C/script%3E',
      queryString: 'q=%3Cscript%3Ealert(1)%3C/script%3E',
    });
    expect(hit?.ruleId).toBe('xss');
  });

  it('blocks CRLF in user-agent', () => {
    const hit = inspectRequestForWaf({
      ...base,
      originalUrl: '/api/auth/me',
      headers: { 'user-agent': 'evil\r\nX-Injected: 1' },
    });
    expect(hit?.ruleId).toBe('header-crlf');
  });

  it('blocks SQL injection in JSON body', () => {
    const hit = inspectRequestForWaf({
      ...base,
      method: 'POST',
      originalUrl: '/api/auth/send-otp',
      body: { value: "1'; DROP TABLE users; --", type: 'mobile' },
    });
    expect(hit?.ruleId).toBe('body-sql-injection');
  });

  it('does not scan large base64 body fields on KYC paths', () => {
    const hit = inspectRequestForWaf({
      ...base,
      method: 'POST',
      originalUrl: '/api/auth/kyc/selfie',
      body: {
        imageBase64: `${'A'.repeat(2000)}union select`,
      },
    });
    expect(hit).toBeNull();
  });
});

describe('WAF env helpers', () => {
  it('defaults to enabled', () => {
    expect(isWafEnabled(undefined)).toBe(true);
    expect(isWafEnabled('false')).toBe(false);
  });

  it('defaults to block mode', () => {
    expect(isWafBlockMode(undefined)).toBe(true);
    expect(isWafBlockMode('log')).toBe(false);
  });
});
