/** HttpOnly cookie payload after mobile OTP (opaque id; server state lives in Redis). */
export interface SessionCookiePayload {
  name: string;
  /** Opaque session identifier; not a JWT. */
  sessionId: string;
  maxAgeMs: number;
}

/** Successful response body for `POST /api/auth/verify-otp` (unified). */
export interface VerifyOtpResult {
  success: boolean;
  requestId: string;
  verified: boolean;
  verifiedAt: string;
  /** Present after mobile verification (customer session established). */
  customerId?: string;
  mobileNumber?: string;
  leadId?: string | null;
  leadStatus?: string | null;
  /** When set, controller must emit `Set-Cookie`. */
  sessionCookie?: SessionCookiePayload;
}
