import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EmailService } from '../../../../common/email/email.service';
import { SmsService } from '../../../../common/sms/sms.service';
import {
  shouldDeliverSmsViaApi,
  shouldFallbackToDebugOtpOnEmailFailure,
  shouldIncludeDebugOtpEmail,
  shouldIncludeDebugOtpMobile,
  shouldSkipEmailOtpDelivery,
} from '../../../../common/sms/sms-delivery.util';
import type { SendOtpDto } from '../dto/send-otp.dto';
import type { SendOtpOptions } from '../contracts/send-otp-options.contract';
import type { SendOtpResult } from '../contracts/send-otp-result.contract';
import { OTP_TYPE } from '../../../../common/constants/otp.constants';
import { SMS_TEMPLATE_ID } from '../../../../common/constants/sms.constants';
import { OtpCodeGenerator } from '../../infrastructure/crypto/otp-code.generator';
import { isValidEmail, maskEmail, normalizeEmail } from '../../infrastructure/utils/email.util';
import { isValidIndianMobile, maskMobile, normalizeMobile } from '../../infrastructure/utils/mobile.util';
import type { CustomerSessionPayload } from '../contracts/customer-session-payload.contract';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { OtpRequestRepository } from '../../infrastructure/repositories/otp-request.repository';
import { OtpTypeRepository } from '../../infrastructure/repositories/otp-type.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';

@Injectable()
export class SendOtpUseCase {
  private readonly logger = new Logger(SendOtpUseCase.name);

  constructor(
    private readonly otpTypes: OtpTypeRepository,
    private readonly otpRequests: OtpRequestRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly otpCodeGenerator: OtpCodeGenerator,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
  ) {}

  async execute(
    dto: SendOtpDto,
    ip: string | undefined,
    customerSession?: CustomerSessionPayload,
    options?: SendOtpOptions,
  ): Promise<SendOtpResult> {
    if (dto.type === OTP_TYPE.EMAIL && !customerSession) {
      throw new UnauthorizedException('Sign in with mobile OTP before requesting an email code.');
    }

    const settings = await this.settingsRepository.loadAuthOtpSettings();
    const otpType = await this.otpTypes.findActiveByName(undefined, dto.type);
    if (!otpType) {
      throw new BadRequestException('This OTP channel is not available.');
    }

    const { canonical, masked } = this.resolveDestination(dto);

    const latest = await this.otpRequests.findLatestPendingByValueAndType(undefined, canonical, otpType.id);
    const now = Date.now();
    if (latest) {
      const nextAllowed = latest.lastSentAt.getTime() + settings.otpResendCooldownSeconds * 1000;
      if (now < nextAllowed) {
        const remainingSeconds = Math.ceil((nextAllowed - now) / 1000);
        const attemptsExhausted = latest.attemptCount >= settings.otpMaxAttempts;
        throw new HttpException(
          attemptsExhausted
            ? `Too many incorrect attempts. Please wait ${remainingSeconds} seconds before requesting a new OTP.`
            : `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }

    const otpCode = this.otpCodeGenerator.generate(settings.otpLength);
    const expiresAt = new Date(now + settings.otpExpireSeconds * 1000);

    const row = await this.otpRequests.create(undefined, {
      value: canonical,
      type: { connect: { id: otpType.id } },
      otpCode,
      ipAddress: ip ?? null,
      lastSentAt: new Date(),
      expiresAt,
      utmSource: dto.utmSource ?? null,
      utmMedium: dto.utmMedium ?? null,
      utmCampaign: dto.utmCampaign ?? null,
      utmTerm: dto.utmTerm ?? null,
      utmContent: dto.utmContent ?? null,
    });

    const emailConfigured = this.emailService.isConfigured();
    let emailDeliveryFailed = false;

    if (dto.type === OTP_TYPE.EMAIL) {
      if (shouldSkipEmailOtpDelivery()) {
        this.logger.log(
          `[otp] EMAIL_OTP_INLINE_ONLY (dev/local): skipping email API; returning debugOtp in API for ${masked} request=${row.uuid}`,
        );
      } else if (emailConfigured) {
        try {
          let leadId: bigint | null = null;
          if (customerSession) {
            const customer = await this.customers.findByUuid(undefined, customerSession.sub);
            if (customer) {
              const lead = await this.leads.findActiveByCustomerId(customer.id);
              leadId = lead?.id ?? null;
            }
          }
          await this.emailService.sendOtpEmail(canonical, otpCode, expiresAt, { leadId });
        } catch (error) {
          emailDeliveryFailed = true;
          const endpoint = this.emailService.smtpEndpointLabel();
          this.logger.error(`Failed to send OTP email to ${masked}`, error instanceof Error ? error.stack : error);
          if (endpoint) {
            this.logger.error(
              `[SendOtpUseCase] Email ${endpoint} unreachable or rejected. ` +
                'Check Zeptomail/SMTP credentials, verified sender domain, and spam folder.',
            );
          }
          if (shouldFallbackToDebugOtpOnEmailFailure()) {
            this.logger.warn(
              `[otp] Email delivery failed in local-like env; returning debugOtp for ${masked} request=${row.uuid}`,
            );
          } else {
            await this.otpRequests.deleteById(undefined, row.id);
            throw new InternalServerErrorException('Could not send verification email. Please try again.');
          }
        }
      } else {
        this.logger.warn(
          `[otp] Email not configured; email not sent. to=${masked} request=${row.uuid} — response includes debugOtp for manual entry (set EMAIL_* or EMAIL_OTP_INLINE_ONLY as needed).`,
        );
      }
    }

    if (dto.type === OTP_TYPE.MOBILE && shouldDeliverSmsViaApi()) {
      try {
        await this.smsService.sendOtpSms(
          canonical,
          otpCode,
          options?.leadId ?? null,
          options?.smsTemplateId ?? SMS_TEMPLATE_ID.LOGIN_OTP,
        );
      } catch (error) {
        this.logger.error(`Failed to send OTP SMS to ${masked}`, error instanceof Error ? error.stack : error);
        await this.otpRequests.deleteById(undefined, row.id);
        throw new InternalServerErrorException('Could not send verification SMS. Please try again.');
      }
    } else if (dto.type === OTP_TYPE.MOBILE) {
      this.logger.log(
        `[otp] SMS delivery skipped for local-like env; returning debugOtp for ${masked} request=${row.uuid}`,
      );
    }

    const isDev = (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';
    if (isDev || process.env.LOG_OTP_TO_CONSOLE === 'true') {
      // eslint-disable-next-line no-console
      console.log(`[otp] type=${dto.type} value=${masked} request=${row.uuid} code=${otpCode}`);
    }

    const resendAvailableAt = new Date(now + settings.otpResendCooldownSeconds * 1000);

    const includeDebugOtpMobile = dto.type === OTP_TYPE.MOBILE && shouldIncludeDebugOtpMobile();
    /** Same UX as mobile `debugOtp`: show code in the app when email is not (or must not be) delivered out-of-band. */
    const includeDebugOtpEmail =
      dto.type === OTP_TYPE.EMAIL &&
      (shouldIncludeDebugOtpEmail(emailConfigured) || emailDeliveryFailed);

    return {
      requestId: row.uuid,
      maskedValue: masked,
      resendAfterSeconds: settings.otpResendCooldownSeconds,
      resendAvailableAt: resendAvailableAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ...((dto.type === OTP_TYPE.MOBILE ? includeDebugOtpMobile : includeDebugOtpEmail) ? { debugOtp: otpCode } : {}),
    };
  }

  private resolveDestination(dto: SendOtpDto): { canonical: string; masked: string } {
    if (dto.type === OTP_TYPE.MOBILE) {
      const mobile = normalizeMobile(dto.value);
      if (!isValidIndianMobile(mobile)) {
        throw new BadRequestException('Enter a valid 10-digit Indian mobile number.');
      }
      return { canonical: mobile, masked: maskMobile(mobile) };
    }

    const email = normalizeEmail(dto.value);
    if (!isValidEmail(email)) {
      throw new BadRequestException('Enter a valid email address.');
    }
    return { canonical: email, masked: maskEmail(email) };
  }
}
