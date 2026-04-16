import { type OtpType } from '../../common/constants/otp.constants';
import { type UtmTrackingParams } from '../../common/types/utm-tracking.types';
import { type VerifiedCustomerProfile } from '../customer/customer.types';

export type OtpIssueParams = UtmTrackingParams & {
  channel: OtpType;
  value: string;
  maskedValue: string;
  ipAddress?: string;
};

export type OtpIssueResult = {
  requestId: string;
  maskedValue: string;
  resendAfterSeconds: number;
  resendAvailableAt: string;
  expiresAt: string;
  debugOtp?: string;
};

export type OtpVerifyParams = {
  channel: OtpType;
  requestId: string;
  otpCode: string;
};

export type OtpVerifyResult = {
  requestId?: string;
  verified?: true;
  verifiedAt?: string;
  leadId?: string;
  token?: string;
  customer?: VerifiedCustomerProfile;
};
