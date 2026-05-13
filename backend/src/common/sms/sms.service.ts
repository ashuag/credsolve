import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey: string | null;
  private readonly senderId: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SMS_API_KEY')?.trim() || null;
    this.senderId = this.config.get<string>('SMS_SENDER_ID')?.trim() || 'MNCASH';
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async sendSms(mobile: string, message: string): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(`[sms] SMS gateway not configured; message not sent. to=${mobile.slice(-4)}`);
      return;
    }

    // TODO: Integrate actual SMS gateway (MSG91 / Twilio / etc.)
    this.logger.log(`[sms] Sending SMS to ****${mobile.slice(-4)}: ${message.slice(0, 50)}...`);
  }

  async sendThankYouSms(mobile: string): Promise<void> {
    const message =
      'Thank you for showing interest in MoneyCash! ' +
      'We appreciate your time. If you have any questions, ' +
      'please contact our support team. - MoneyCash';

    const isDev = (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';
    if (isDev || process.env.LOG_SMS_TO_CONSOLE === 'true') {
      // eslint-disable-next-line no-console
      console.log(`[sms] thank-you to=****${mobile.slice(-4)} message=${message}`);
    }

    await this.sendSms(mobile, message);
  }
}
