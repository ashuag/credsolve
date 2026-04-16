import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OTP_TYPE, type OtpType } from '../../../common/constants/otp.constants';
import { OTP_LENGTH } from '../auth.constants';
import { SendOtpDto } from '../dto/inputDto/send-otp.dto';
import { InvalidOtpValueException } from '../exceptions/invalid-otp-value.exception';
import { type OtpIssueParams } from '../auth.types';

@Injectable()
export class OtpIssuerService {
  prepareSendOtpPayload(dto: SendOtpDto, ipAddress?: string): OtpIssueParams {
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
    return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
  }

  shouldExposeDebugOtp() {
    return process.env.NODE_ENV !== 'production';
  }

  private normalizeSendOtpValue(type: OtpType, value: string | number) {
    if (type === OTP_TYPE.MOBILE) {
      const normalizedMobileValue = typeof value === 'number' ? String(value) : value.replace(/\D/g, '').slice(0, 10);

      if (!/^[6-9]\d{9}$/.test(normalizedMobileValue)) {
        throw new InvalidOtpValueException(type);
      }

      return normalizedMobileValue;
    }

    const normalizedEmailValue = String(value ?? '').trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmailValue)) {
      throw new InvalidOtpValueException(type);
    }

    return normalizedEmailValue;
  }

  private maskValue(type: OtpType, value: string) {
    return type === OTP_TYPE.EMAIL ? this.maskEmail(value) : this.maskMobile(value);
  }

  private maskMobile(mobileNumber: string) {
    return `+91 ${mobileNumber.slice(0, 2)}*** ***${mobileNumber.slice(-2)}`;
  }

  private maskEmail(email: string) {
    const [localPart, domain = ''] = email.split('@');
    const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
    const maskedLocalPart = `${visiblePrefix}${'*'.repeat(Math.max(3, localPart.length - visiblePrefix.length))}`;

    return `${maskedLocalPart}@${domain}`;
  }

  private normalizeIpAddress(ipAddress?: string) {
    const normalizedIpAddress = ipAddress?.trim();

    return normalizedIpAddress ? normalizedIpAddress.slice(0, 45) : undefined;
  }

  private normalizeTrackingValue(value?: string) {
    const normalizedValue = value?.trim();

    return normalizedValue ? normalizedValue.slice(0, 100) : undefined;
  }
}
