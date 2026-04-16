export const SettingKey = {
    LEAD_EXPIRE_DAYS: {
        key: 'LEAD_EXPIRE_DAYS',
        default: '90',
        description: 'Days before lead expires',
    },
    OTP_EXPIRE_DURATION: {
        key: 'OTP_EXPIRE_DURATION',
        default: '120',
        description: 'OTP expiry in seconds',
    },
    OTP_MAX_ATTEMPTS: {
        key: 'OTP_MAX_ATTEMPTS',
        default: '3',
        description: 'Max OTP verification attempts',
    },
    OTP_RESEND_COOLDOWN: {
        key: 'OTP_RESEND_COOLDOWN',
        default: '30',
        description: 'Seconds before OTP can be resent',
    },
    KYC_VALIDITY_DAYS: {
        key: 'KYC_VALIDITY_DAYS',
        default: '180',
        description: 'Days before KYC re-verification required',
    },
    OTP_LENGTH: {
        key: 'OTP_LENGTH',
        default: '6',
        description: 'Length of OTP',
    },
    OTP_RATE_LIMIT_WINDOW_SECONDS: {
        key: 'OTP_RATE_LIMIT_WINDOW_SECONDS',
        default: '300',
        description: 'in seconds',
    },
    CUSTOMER_AUTH_COOKIE_NAME: {
        key: 'CUSTOMER_AUTH_COOKIE_NAME',
        default: 'access_token',
        description: 'Server side cookie set for auth',
    },
    CUSTOMER_AUTH_COOKIE_MAX_AGE_MS: {
        key: 'CUSTOMER_AUTH_COOKIE_NAME',
        default: '2592000',
        description: 'Cookie lifetime in S',
    },
    LOAN_TENURE: {
        key: 'LOAN_TENURE',
        default: '30',
        description: 'Loan maturity date'
    },
    ROI_PER_DAY: {
      key: 'ROI_PER_DAY',
      default: '1',
      description: 'Per day interest rate'
    },
    PROCESSING_FEE: {
        key: 'PROCESSING_FEE',
        default: '12',
        description: 'Processing fees on loan amount'
    },
    PROCESSING_FEE_GST: {
        key: 'PROCESSING_FEE_GST',
        default: '18',
        description: 'Gst on Processing fee',
    },
    MIN_LOAN_AMOUNT: {
        key: 'MIN_LOAN_AMOUNT',
        default: '2000',
        description: 'Minimum loan amount that can be offered',
    },
    MAX_LOAN_AMOUNT: {
        key: 'MAX_LOAN_AMOUNT',
        default: '30000',
        description: 'Maximum loan amount that can be offered',
    },
} as const;
