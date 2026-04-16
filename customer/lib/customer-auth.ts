import { formatCustomerMobile, isValidCustomerMobile } from './mobile';

export type CustomerProfile = {
  customerId: string;
  mobileNumber: string | null;
};

export type AuthenticatedCustomer = {
  customerId: string;
  mobileNumber?: string | null;
  email?: string | null;
  fullName?: string | null;
  authProvider?: 'mobile_otp' | 'email_otp' | 'google';
  createdAt: string;
};

export type CustomerUtmParams = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

export function getAuthenticatedCustomerDisplayLabel(
  customer: { fullName?: string | null; email?: string | null; mobileNumber?: string | null }
) {
  const fullName = customer.fullName?.trim();
  if (fullName) return fullName;

  const email = customer.email?.trim();
  if (email) return email;

  const mobileNumber = customer.mobileNumber?.trim();
  if (mobileNumber && isValidCustomerMobile(mobileNumber)) {
    return formatCustomerMobile(mobileNumber);
  }

  return 'your account';
}
