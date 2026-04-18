/** Successful response body for `POST /api/auth/send-otp` (unified mobile + email). */
export interface SendOtpResult {
  requestId: string;
  maskedValue: string;
  resendAfterSeconds: number;
  resendAvailableAt: string;
  expiresAt: string;
  /** Only in non-production when enabled. */
  debugOtp?: string;
}
