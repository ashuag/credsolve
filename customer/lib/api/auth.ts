import type { CustomerUtmParams } from '../customer-auth';
import { readCustomerUtmParams } from '../customer-utm';
import { getOtpTypeValuesSnapshot, setOtpTypeStoreValues, type OtpTypeValue } from '../stores/otp-type-store';
import { apiGet, apiPost } from './client';

type SendUnifiedOtpResponse = {
  requestId: string;
  maskedValue: string;
  resendAfterSeconds: number;
  resendAvailableAt: string;
  expiresAt: string;
  debugOtp?: string;
};

type GetOtpTypesResponse = {
  values: OtpTypeValue[];
};

type SendOtpRequestPayload = {
  type: OtpTypeValue;
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

export async function fetchOtpTypeValues(): Promise<OtpTypeValue[]> {
  const data = await apiGet<GetOtpTypesResponse>(
    '/auth/otp-types',
    'Unable to load OTP types right now.'
  );
  const values = Array.isArray(data?.values) ? data.values : [];

  setOtpTypeStoreValues(values);

  return values;
}

async function sendOtpRequest(payload: SendOtpRequestPayload): Promise<SendUnifiedOtpResponse> {
  const storedOtpTypeValues = getOtpTypeValuesSnapshot();

  if (storedOtpTypeValues.length > 0 && !storedOtpTypeValues.includes(payload.type)) {
    throw new Error('Unsupported OTP type.');
  }

  return (await apiPost<SendUnifiedOtpResponse>(
    '/auth/send-otp',
    payload,
    'Unable to send OTP right now. Please try again.'
  )) as SendUnifiedOtpResponse;
}

async function verifyOtpRequest<T>(payload: {
  type: OtpTypeValue;
  requestId: string;
  otpCode: string;
}): Promise<T> {
  return (await apiPost<T>(
    '/auth/verify-otp',
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

export async function logoutCustomerSession(): Promise<void> {
  await apiPost<{ success?: boolean }>(
    '/auth/logout',
    {},
    'Unable to logout right now. Please try again.'
  );
}
