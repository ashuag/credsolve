export const SMS_PRODUCT = {
  OTP: 'OTP',
  TRANSACTIONAL: 'Transactional',
} as const;

export type SmsProduct = (typeof SMS_PRODUCT)[keyof typeof SMS_PRODUCT];

/** DLT template IDs — multiple rows may share gateway product `OTP` or `Transactional`. */
export const SMS_TEMPLATE_ID = {
  LOGIN_OTP: '1007367040598516340',
  ESIGN_OTP: '1007997896537338264',
  REJECTION: '1007442260135588994',
  UNDER_REVIEW: '1007403812823956210',
  INTERNAL_ERROR: '1007451652989283798',
} as const;
