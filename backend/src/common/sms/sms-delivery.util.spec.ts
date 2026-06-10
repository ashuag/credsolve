import {
  shouldDeliverSmsViaApi,
  shouldFallbackToDebugOtpOnEmailFailure,
  shouldIncludeDebugOtpEmail,
  shouldIncludeDebugOtpMobile,
  shouldSkipEmailOtpDelivery,
} from './sms-delivery.util';

describe('sms-delivery.util', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('delivers via API in production when SMS flags are unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SMS_DELIVERY_ENABLED;
    delete process.env.SMS_DELIVERY_ON_LOCAL;
    expect(shouldDeliverSmsViaApi()).toBe(true);
    expect(shouldIncludeDebugOtpMobile()).toBe(false);
  });

  it('skips API in production when SMS_DELIVERY_ON_LOCAL is false', () => {
    process.env.NODE_ENV = 'production';
    process.env.SMS_DELIVERY_ON_LOCAL = 'false';
    expect(shouldDeliverSmsViaApi()).toBe(false);
  });

  it('honors SMS_DELIVERY_ENABLED=false in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SMS_DELIVERY_ENABLED = 'false';
    process.env.SMS_DELIVERY_ON_LOCAL = 'true';
    expect(shouldDeliverSmsViaApi()).toBe(false);
  });

  it('honors SMS_DELIVERY_ENABLED=true in local-like env', () => {
    process.env.NODE_ENV = 'dev';
    process.env.SMS_DELIVERY_ENABLED = 'true';
    process.env.SMS_DELIVERY_ON_LOCAL = 'false';
    expect(shouldDeliverSmsViaApi()).toBe(true);
  });

  it('skips API on dev when SMS_DELIVERY_ON_LOCAL is false', () => {
    process.env.NODE_ENV = 'dev';
    process.env.SMS_DELIVERY_ON_LOCAL = 'false';
    expect(shouldDeliverSmsViaApi()).toBe(false);
    expect(shouldIncludeDebugOtpMobile()).toBe(true);
  });

  it('delivers via API on dev when SMS_DELIVERY_ON_LOCAL is true', () => {
    process.env.NODE_ENV = 'dev';
    process.env.SMS_DELIVERY_ON_LOCAL = 'true';
    expect(shouldDeliverSmsViaApi()).toBe(true);
    expect(shouldIncludeDebugOtpMobile()).toBe(false);
  });

  it('honors INCLUDE_DEBUG_OTP=false on local-like env', () => {
    process.env.NODE_ENV = 'stage';
    process.env.SMS_DELIVERY_ON_LOCAL = 'false';
    process.env.INCLUDE_DEBUG_OTP = 'false';
    expect(shouldIncludeDebugOtpMobile()).toBe(false);
  });

  it('includes email debug OTP on staging when email is configured', () => {
    process.env.NODE_ENV = 'staging';
    delete process.env.EMAIL_OTP_INLINE_ONLY;
    delete process.env.INCLUDE_DEBUG_OTP_EMAIL;
    expect(shouldIncludeDebugOtpEmail(true)).toBe(true);
  });

  it('includes email debug OTP when email is not configured', () => {
    process.env.NODE_ENV = 'production';
    expect(shouldIncludeDebugOtpEmail(false)).toBe(true);
  });

  it('falls back to debug OTP on email failure in staging', () => {
    process.env.NODE_ENV = 'staging';
    expect(shouldFallbackToDebugOtpOnEmailFailure()).toBe(true);
  });

  it('skips email delivery with EMAIL_OTP_INLINE_ONLY on dev only', () => {
    process.env.EMAIL_OTP_INLINE_ONLY = 'true';
    process.env.NODE_ENV = 'dev';
    expect(shouldSkipEmailOtpDelivery()).toBe(true);
    process.env.NODE_ENV = 'staging';
    expect(shouldSkipEmailOtpDelivery()).toBe(false);
    process.env.NODE_ENV = 'production';
    expect(shouldSkipEmailOtpDelivery()).toBe(false);
  });

  it('includes debug OTP when EMAIL_OTP_INLINE_ONLY on staging', () => {
    process.env.EMAIL_OTP_INLINE_ONLY = 'true';
    process.env.NODE_ENV = 'staging';
    expect(shouldIncludeDebugOtpEmail(true)).toBe(true);
    expect(shouldSkipEmailOtpDelivery()).toBe(false);
  });
});
