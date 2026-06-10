const LOCAL_LIKE_ENVS = new Set(['dev', 'development', 'stage', 'staging', 'local']);
/** Dev workstations only — staging/production are not included. */
const DEV_ONLY_ENVS = new Set(['dev', 'development', 'local']);

function parseEnvFlag(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return undefined;
}

export function isLocalLikeNodeEnv(): boolean {
  const env = (process.env.NODE_ENV ?? 'development').trim().toLowerCase();
  return LOCAL_LIKE_ENVS.has(env);
}

export function isDevOnlyNodeEnv(): boolean {
  const env = (process.env.NODE_ENV ?? 'development').trim().toLowerCase();
  return DEV_ONLY_ENVS.has(env);
}

function isEmailOtpInlineOnlyFlagSet(): boolean {
  return (process.env.EMAIL_OTP_INLINE_ONLY ?? '').trim().toLowerCase() === 'true';
}

/**
 * When true, skip Zeptomail/SMTP for email OTP and rely on `debugOtp` in the API response.
 * `EMAIL_OTP_INLINE_ONLY` applies only on dev/local; staging and production still send when configured.
 */
export function shouldSkipEmailOtpDelivery(): boolean {
  return isEmailOtpInlineOnlyFlagSet() && isDevOnlyNodeEnv();
}

/** When true, outbound SMS API is called; otherwise OTP is returned in the API response for manual entry. */
export function shouldDeliverSmsViaApi(): boolean {
  const deliveryEnabled = parseEnvFlag(process.env.SMS_DELIVERY_ENABLED);
  if (deliveryEnabled !== undefined) {
    return deliveryEnabled;
  }

  const localDelivery = parseEnvFlag(process.env.SMS_DELIVERY_ON_LOCAL);
  if (localDelivery === false) {
    return false;
  }

  if (!isLocalLikeNodeEnv()) {
    return true;
  }

  return localDelivery === true;
}

export function shouldIncludeDebugOtpMobile(): boolean {
  if (shouldDeliverSmsViaApi()) {
    return (process.env.INCLUDE_DEBUG_OTP ?? '').trim().toLowerCase() === 'true';
  }
  return process.env.INCLUDE_DEBUG_OTP !== 'false';
}

/** When true, email OTP responses include `debugOtp` for in-app entry (dev/staging or when mail is off). */
export function shouldIncludeDebugOtpEmail(emailConfigured: boolean): boolean {
  if (isEmailOtpInlineOnlyFlagSet()) {
    return true;
  }
  if ((process.env.INCLUDE_DEBUG_OTP_EMAIL ?? '').trim().toLowerCase() === 'true') {
    return true;
  }
  if (!emailConfigured) {
    return true;
  }
  if (isLocalLikeNodeEnv()) {
    return (process.env.INCLUDE_DEBUG_OTP_EMAIL ?? '').trim().toLowerCase() !== 'false';
  }
  return false;
}

/** In dev/staging, keep the OTP usable in-app when Zeptomail/SMTP fails instead of returning HTTP 500. */
export function shouldFallbackToDebugOtpOnEmailFailure(): boolean {
  return isLocalLikeNodeEnv() || isEmailOtpInlineOnlyFlagSet();
}
