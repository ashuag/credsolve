export const SMS_PRODUCT = {
  OTP: 'OTP',
  TRANSACTIONAL: 'Transactional',
} as const;

export type SmsProduct = (typeof SMS_PRODUCT)[keyof typeof SMS_PRODUCT];

/** DLT template IDs — multiple rows may share gateway product `OTP`. */
export const SMS_TEMPLATE_ID = {
  LOGIN_OTP: '1007367040598516340',
  ESIGN_OTP: '1007997896537338264',
} as const;
