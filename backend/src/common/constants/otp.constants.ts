export const OTP_TYPE = {
    MOBILE: 'mobile',
    EMAIL: 'email',
} as const;

export type OtpType = typeof OTP_TYPE[keyof typeof OTP_TYPE];
