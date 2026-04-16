import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OTP_EXPIRY_SECONDS, OTP_RESEND_AFTER_SECONDS } from '../auth.constants';
import { MailConfigurationException } from '../../mail/exceptions/mail-configuration.exception';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class OtpEmailService {
  private readonly logger = new Logger(OtpEmailService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService
  ) {}

  async sendOtpEmail(email: string, otpCode: string) {
    if (!this.mailService.isConfigured()) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw new MailConfigurationException(this.mailService.getMissingConfigurationKeys().join(', '));
      }

      this.logger.warn(
        `Skipping OTP email delivery because SMTP configuration is incomplete: ${this.mailService.getMissingConfigurationKeys().join(', ')}.`
      );
      return false;
    }

    const expiryMinutes = Math.ceil(OTP_EXPIRY_SECONDS / 60);

    await this.mailService.send({
      to: email,
      subject: 'Your MoneyCash verification code',
      text: [
        'Your MoneyCash verification code is below.',
        '',
        `OTP: ${otpCode}`,
        `This code expires in ${expiryMinutes} minutes.`,
        `You can request a new code after ${OTP_RESEND_AFTER_SECONDS} seconds.`,
        '',
        'Do not share this code with anyone.'
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; color: #12244f; line-height: 1.6;">
          <p>Your MoneyCash verification code is below.</p>
          <div style="margin: 20px 0; display: inline-block; padding: 14px 20px; border-radius: 12px; background: #f4f8ff; border: 1px solid #d7e5ff; font-size: 28px; font-weight: 700; letter-spacing: 0.18em;">
            ${otpCode}
          </div>
          <p>This code expires in ${expiryMinutes} minutes.</p>
          <p>You can request a new code after ${OTP_RESEND_AFTER_SECONDS} seconds.</p>
          <p>Do not share this code with anyone.</p>
        </div>
      `
    });

    return true;
  }
}
