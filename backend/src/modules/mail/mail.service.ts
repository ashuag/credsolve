import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require('nodemailer') as typeof import('nodemailer');
type Transporter = ReturnType<typeof nodemailer.createTransport>;
import { errorWithStack } from '../../common/logging/logger.utils';
import { MailConfigurationException } from './exceptions/mail-configuration.exception';
import { MailDeliveryException } from './exceptions/mail-delivery.exception';
import { type SendMailParams } from './mail.types';

const REQUIRED_MAIL_CONFIG_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] as const;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  isConfigured() {
    return this.getMissingConfigurationKeys().length === 0;
  }

  getMissingConfigurationKeys() {
    return REQUIRED_MAIL_CONFIG_KEYS.filter((key) => !this.configService.get<string>(key)?.trim());
  }

  async send(params: SendMailParams) {
    const transporter = this.getTransporter();

    try {
      const info = await transporter.sendMail({
        from: params.from ?? this.getDefaultFromAddress(),
        to: params.to,
        subject: params.subject,
        text: params.text,
        ...(params.html ? { html: params.html } : {}),
        ...(params.replyTo ? { replyTo: params.replyTo } : {})
      });

      this.logger.log(
        `Email queued to ${Array.isArray(params.to) ? params.to.join(', ') : params.to}. Response: ${info.response}`
      );
    } catch (error) {
      errorWithStack(
        this.logger,
        `Failed to send email to ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`,
        error
      );

      throw new MailDeliveryException();
    }
  }

  private getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    const port = this.getRequiredPort();
    const secure = this.getSecureFlag(port);

    this.transporter = nodemailer.createTransport({
      host: this.getRequiredConfig('SMTP_HOST'),
      port,
      secure,
      auth: {
        user: this.getRequiredConfig('SMTP_USER'),
        pass: this.getRequiredConfig('SMTP_PASS')
      }
    });

    return this.transporter;
  }

  private getDefaultFromAddress() {
    const fromAddress = this.configService.get<string>('MAIL_FROM_ADDRESS')?.trim()
      || this.configService.get<string>('SMTP_USER')?.trim();

    if (!fromAddress) {
      throw new MailConfigurationException('MAIL_FROM_ADDRESS');
    }

    const fromName = this.configService.get<string>('MAIL_FROM_NAME')?.trim();

    return fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;
  }

  private getRequiredConfig(key: (typeof REQUIRED_MAIL_CONFIG_KEYS)[number]) {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new MailConfigurationException(key);
    }

    return value;
  }

  private getRequiredPort() {
    const rawPort = this.getRequiredConfig('SMTP_PORT');
    const port = Number.parseInt(rawPort, 10);

    if (!Number.isInteger(port) || port <= 0) {
      throw new MailConfigurationException('SMTP_PORT');
    }

    return port;
  }

  private getSecureFlag(port: number) {
    const value = this.configService.get<string>('SMTP_SECURE')?.trim().toLowerCase();

    if (!value) {
      return port === 465;
    }

    return ['1', 'true', 'yes', 'on'].includes(value);
  }
}
