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
        default: 'mc_sid',
        description: 'HttpOnly cookie name for opaque customer session id (server-side session in Redis)',
    },
    CUSTOMER_SESSION_TTL_MS: {
        key: 'CUSTOMER_SESSION_TTL_MS',
        default: '900000',
        description: 'Customer session lifetime in ms (Redis TTL and cookie max-age; e.g. 900000 = 15 minutes)',
    },
    CUSTOMER_SESSION_SLIDING: {
        key: 'CUSTOMER_SESSION_SLIDING',
        default: 'true',
        description: 'When true, extend session TTL on each authenticated request (activity-based)',
    },
    CUSTOMER_SESSION_ROTATE_ON_USE: {
        key: 'CUSTOMER_SESSION_ROTATE_ON_USE',
        default: 'false',
        description: 'When true, issue a new session id on each authenticated request (stronger; more Redis writes)',
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
    BUREAU_FETCH_ENABLED: {
        key: 'BUREAU_FETCH_ENABLED',
        default: '1',
        description:
            'Bureau after PAN: 0/false = off; 1/true = live Tenacio bureau; 2 = mock success (no HTTP, fixed payload)',
    },
    PAN_VERIFICATION_ENABLED: {
        key: 'PAN_VERIFICATION_ENABLED',
        default: '1',
        description:  'Need to check Pan is verified or not',
    },
    REAPPLY_AFTER_REJECTED: {
        key: 'REAPPLY_AFTER_REJECTED',
        default: '90',
        description:  'Days after which lead can be re-applied after rejection',
    },
    BLACKLIST_REJECTION_THRESHOLD: {
        key: 'BLACKLIST_REJECTION_THRESHOLD',
        default: '2',
        description:  'Max consecutive rejection count',
    },
    BLACKLIST_DURATION_DAYS: {
        key: 'BLACKLIST_DURATION_DAYS',
        default: '90',
        description:  'Days after which lead can be re-applied after consecutive rejection',
    },
    MIN_LIVENESS_API_SCORE: {
        key: 'MIN_LIVENESS_API_SCORE',
        default: '0.8',
        description: 'Minimum liveness score from third-party API to pass liveness check',  
    },
    PAN_VALIDATION_ATTEMPTS: {
        key: 'PAN_VALIDATION_ATTEMPTS',
        default: '2',
        description: 'Number of attempts allowed for PAN validation BEFORE HITTING THE pan nsdl api',
    }
} as const;
