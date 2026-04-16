"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpIssuerService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const otp_constants_1 = require("../../../common/constants/otp.constants");
const auth_constants_1 = require("../auth.constants");
const invalid_otp_value_exception_1 = require("../exceptions/invalid-otp-value.exception");
let OtpIssuerService = class OtpIssuerService {
    prepareSendOtpPayload(dto, ipAddress) {
        const value = this.normalizeSendOtpValue(dto.type, dto.value);
        return {
            channel: dto.type,
            value,
            maskedValue: this.maskValue(dto.type, value),
            ipAddress: this.normalizeIpAddress(ipAddress),
            utmSource: this.normalizeTrackingValue(dto.utmSource),
            utmMedium: this.normalizeTrackingValue(dto.utmMedium),
            utmCampaign: this.normalizeTrackingValue(dto.utmCampaign),
            utmTerm: this.normalizeTrackingValue(dto.utmTerm),
            utmContent: this.normalizeTrackingValue(dto.utmContent)
        };
    }
    generateOtpCode() {
        return (0, node_crypto_1.randomInt)(0, 10 ** auth_constants_1.OTP_LENGTH).toString().padStart(auth_constants_1.OTP_LENGTH, '0');
    }
    shouldExposeDebugOtp() {
        return process.env.NODE_ENV !== 'production';
    }
    normalizeSendOtpValue(type, value) {
        if (type === otp_constants_1.OTP_TYPE.MOBILE) {
            const normalizedMobileValue = typeof value === 'number' ? String(value) : value.replace(/\D/g, '').slice(0, 10);
            if (!/^[6-9]\d{9}$/.test(normalizedMobileValue)) {
                throw new invalid_otp_value_exception_1.InvalidOtpValueException(type);
            }
            return normalizedMobileValue;
        }
        const normalizedEmailValue = String(value ?? '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmailValue)) {
            throw new invalid_otp_value_exception_1.InvalidOtpValueException(type);
        }
        return normalizedEmailValue;
    }
    maskValue(type, value) {
        return type === otp_constants_1.OTP_TYPE.EMAIL ? this.maskEmail(value) : this.maskMobile(value);
    }
    maskMobile(mobileNumber) {
        return `+91 ${mobileNumber.slice(0, 2)}*** ***${mobileNumber.slice(-2)}`;
    }
    maskEmail(email) {
        const [localPart, domain = ''] = email.split('@');
        const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
        const maskedLocalPart = `${visiblePrefix}${'*'.repeat(Math.max(3, localPart.length - visiblePrefix.length))}`;
        return `${maskedLocalPart}@${domain}`;
    }
    normalizeIpAddress(ipAddress) {
        const normalizedIpAddress = ipAddress?.trim();
        return normalizedIpAddress ? normalizedIpAddress.slice(0, 45) : undefined;
    }
    normalizeTrackingValue(value) {
        const normalizedValue = value?.trim();
        return normalizedValue ? normalizedValue.slice(0, 100) : undefined;
    }
};
exports.OtpIssuerService = OtpIssuerService;
exports.OtpIssuerService = OtpIssuerService = __decorate([
    (0, common_1.Injectable)()
], OtpIssuerService);
