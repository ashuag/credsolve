/** Backend `UnauthorizedException` copy when the customer session cookie is missing or invalid. */
export const CUSTOMER_SESSION_REQUIRED_MESSAGE =
  'Sign in with mobile OTP before continuing.';

export const CUSTOMER_MOBILE_OTP_LOGIN_PATH = '/apply-for-loan';

export function isCustomerSessionRequiredMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    message.trim() === CUSTOMER_SESSION_REQUIRED_MESSAGE ||
    normalized.includes('sign in with mobile otp')
  );
}
