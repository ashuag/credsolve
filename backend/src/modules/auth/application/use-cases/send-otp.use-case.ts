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
import type { SendOtpDto } from '../dto/send-otp.dto';
import type { SendOtpResult } from '../contracts/send-otp-result.contract';
import { OTP_TYPE } from '../../../../common/constants/otp.constants';
import { OtpCodeGenerator } from '../../infrastructure/crypto/otp-code.generator';
import { isValidEmail, maskEmail, normalizeEmail } from '../../infrastructure/utils/email.util';
import { isValidIndianMobile, maskMobile, normalizeMobile } from '../../infrastructure/utils/mobile.util';
import type { CustomerSessionPayload } from '../contracts/customer-session-payload.contract';
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
    private readonly emailService: EmailService
  ) {}

  async execute(dto: SendOtpDto, ip: string | undefined, customerSession?: CustomerSessionPayload): Promise<SendOtpResult> {
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
        throw new HttpException(
          `Please wait ${settings.otpResendCooldownSeconds} seconds before requesting another OTP.`,
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

    const emailOtpInlineOnly = (process.env.EMAIL_OTP_INLINE_ONLY ?? '').trim().toLowerCase() === 'true';
    const includeDebugOtpEmailFlag = (process.env.INCLUDE_DEBUG_OTP_EMAIL ?? '').trim().toLowerCase() === 'true';

    if (dto.type === OTP_TYPE.EMAIL) {
      if (emailOtpInlineOnly) {
        this.logger.log(`[otp] EMAIL_OTP_INLINE_ONLY: skipping SMTP; returning debugOtp in API for ${masked} request=${row.uuid}`);
      } else if (this.emailService.isConfigured()) {
        try {
          await this.emailService.sendOtpEmail(canonical, otpCode, expiresAt);
        } catch (error) {
          const endpoint = this.emailService.smtpEndpointLabel();
          this.logger.error(`Failed to send OTP email to ${masked}`, error instanceof Error ? error.stack : error);
          if (endpoint) {
            this.logger.error(
              `[SendOtpUseCase] SMTP ${endpoint} unreachable from this host (timeout/refused). ` +
                'Check: (1) outbound port from this VPS, (2) mail server firewall allows this server public IP, ' +
                '(3) set SMTP_FAMILY=4 if IPv6 to the mail host hangs, (4) try port 587+STARTTLS if 465 is blocked.',
            );
          }
          await this.otpRequests.deleteById(undefined, row.id);
          throw new InternalServerErrorException('Could not send verification email. Please try again.');
        }
      } else {
        this.logger.warn(
          `[otp] SMTP not configured; email not sent. to=${masked} request=${row.uuid} — response includes debugOtp for manual entry (set SMTP or EMAIL_OTP_INLINE_ONLY as needed).`,
        );
      }
    }

    const isDev = (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';
    if (isDev || process.env.LOG_OTP_TO_CONSOLE === 'true') {
      // eslint-disable-next-line no-console
      console.log(`[otp] type=${dto.type} value=${masked} request=${row.uuid} code=${otpCode}`);
    }

    const resendAvailableAt = new Date(now + settings.otpResendCooldownSeconds * 1000);

    const includeDebugOtpMobile = isDev && process.env.INCLUDE_DEBUG_OTP !== 'false';
    /** Same UX as mobile `debugOtp`: show code in the app when email is not (or must not be) delivered out-of-band. */
    const includeDebugOtpEmail =
      dto.type === OTP_TYPE.EMAIL &&
      (emailOtpInlineOnly ||
        includeDebugOtpMobile ||
        includeDebugOtpEmailFlag ||
        !this.emailService.isConfigured());

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
