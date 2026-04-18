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
