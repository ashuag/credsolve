"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingKey = void 0;
exports.SettingKey = {
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
};
