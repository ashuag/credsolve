import type { CustomerUtmParams } from '../customer-auth';
import { readCustomerUtmParams } from '../customer-utm';
import { apiGet, apiPost } from './client';

/** Unified OTP channel; must match backend `OTP_TYPE` values. */
export type OtpChannel = 'mobile' | 'email';

/** Relative to `getApiUrl()` (e.g. `/api` in the browser → `/api/auth/...`). */
const AUTH = '/auth';

type SendUnifiedOtpResponse = {
  requestId: string;
  maskedValue: string;
  resendAfterSeconds: number;
  resendAvailableAt: string;
  expiresAt: string;
  debugOtp?: string;
};

type SendOtpRequestPayload = {
  type: OtpChannel;
  value: string | number;
} & CustomerUtmParams;

export type SendOtpResponse = {
  requestId: string;
  mobileNumber: string;
  maskedMobile: string;
  resendAfterSeconds: number;
  resendAvailableAt: string;
  expiresAt: string;
  debugOtp?: string;
};

export type VerifyCustomerOtpResponse = {
  success?: boolean;
  requestId?: string;
  verified?: boolean;
  verifiedAt?: string;
  leadId?: string;
  leadStatus?: string;
  customerId?: string;
  mobileNumber?: string;
};

export type SendEmailOtpResponse = {
  requestId: string;
  email: string;
  maskedEmail: string;
  resendAfterSeconds: number;
  resendAvailableAt: string;
  expiresAt: string;
  debugOtp?: string;
};

export type VerifyEmailOtpResponse = {
  requestId?: string;
  verified?: boolean;
  verifiedAt?: string;
};

async function sendOtpRequest(payload: SendOtpRequestPayload): Promise<SendUnifiedOtpResponse> {
  return (await apiPost<SendUnifiedOtpResponse>(
    `${AUTH}/send-otp`,
    payload,
    'Unable to send OTP right now. Please try again.'
  )) as SendUnifiedOtpResponse;
}

async function verifyOtpRequest<T>(payload: {
  type: OtpChannel;
  requestId: string;
  otpCode: string;
}): Promise<T> {
  return (await apiPost<T>(
    `${AUTH}/verify-otp`,
    payload,
    'Unable to verify OTP right now. Please try again.'
  )) as T;
}

export async function sendCustomerOtp(mobileNumber: string | number) {
  const normalizedMobile = typeof mobileNumber === 'number' ? mobileNumber : Number.parseInt(mobileNumber, 10);
  const data = await sendOtpRequest({
    type: 'mobile',
    value: normalizedMobile,
    ...(readCustomerUtmParams() ?? {})
  });

  return {
    requestId: data.requestId,
    mobileNumber: String(normalizedMobile),
    maskedMobile: data.maskedValue,
    resendAfterSeconds: data.resendAfterSeconds,
    resendAvailableAt: data.resendAvailableAt,
    expiresAt: data.expiresAt,
    ...(data.debugOtp ? { debugOtp: data.debugOtp } : {})
  } satisfies SendOtpResponse;
}

export async function verifyCustomerOtp(requestId: string, otpCode: string): Promise<VerifyCustomerOtpResponse> {
  return verifyOtpRequest<VerifyCustomerOtpResponse>({ type: 'mobile', requestId, otpCode });
}

export async function sendEmailOtp(email: string): Promise<SendEmailOtpResponse> {
  const normalizedEmail = email.trim().toLowerCase();
  const data = await sendOtpRequest({
    type: 'email',
    value: normalizedEmail,
    ...(readCustomerUtmParams() ?? {})
  });

  return {
    requestId: data.requestId,
    email: normalizedEmail,
    maskedEmail: data.maskedValue,
    resendAfterSeconds: data.resendAfterSeconds,
    resendAvailableAt: data.resendAvailableAt,
    expiresAt: data.expiresAt,
    ...(data.debugOtp ? { debugOtp: data.debugOtp } : {})
  };
}

export async function verifyEmailOtp(requestId: string, otpCode: string): Promise<VerifyEmailOtpResponse> {
  return verifyOtpRequest<VerifyEmailOtpResponse>({ type: 'email', requestId, otpCode });
}
