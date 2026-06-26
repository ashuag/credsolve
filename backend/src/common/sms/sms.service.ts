import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SMS_PRODUCT, SMS_TEMPLATE_ID, type SmsProduct } from '../constants/sms.constants';
import { shouldDeliverSmsViaApi } from './sms-delivery.util';
import { SmsVendorService } from './sms-vendor.service';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsVendor: SmsVendorService,
  ) {}

  isConfigured(): boolean {
    return this.smsVendor.isConfigured();
  }

  async sendOtpSms(
    mobile: string,
    otpCode: string,
    leadId?: bigint | null,
    templateId: string = SMS_TEMPLATE_ID.LOGIN_OTP,
  ): Promise<void> {
    await this.sendProductSms(
      mobile,
      SMS_PRODUCT.OTP,
      leadId,
      { '<OTP>': otpCode },
      { throwOnFailure: true, templateId },
    );
  }

  /** Loan document eSign acceptance OTP (gateway product `OTP`, separate DLT template). */
  async sendEsignOtpSms(mobile: string, otpCode: string, leadId?: bigint | null): Promise<void> {
    await this.sendOtpSms(mobile, otpCode, leadId, SMS_TEMPLATE_ID.ESIGN_OTP);
  }

  /** Loan / application rejection SMS (Transactional product template). */
  async sendRejectionSms(mobile: string, leadId?: bigint | null): Promise<void> {
    await this.sendProductSms(mobile, SMS_PRODUCT.TRANSACTIONAL, leadId, undefined, {
      templateId: SMS_TEMPLATE_ID.REJECTION,
    });
  }

  /** Application under-review SMS after journey completion (Transactional product template). */
  async sendUnderReviewSms(mobile: string, leadId?: bigint | null): Promise<void> {
    await this.sendProductSms(mobile, SMS_PRODUCT.TRANSACTIONAL, leadId, undefined, {
      templateId: SMS_TEMPLATE_ID.UNDER_REVIEW,
    });
  }

  /** Customer SMS when a vendor API returns HTTP / business 5XX (technical issue template). */
  async sendInternalErrorSms(mobile: string, leadId?: bigint | null): Promise<void> {
    await this.sendProductSms(mobile, SMS_PRODUCT.TRANSACTIONAL, leadId, undefined, {
      templateId: SMS_TEMPLATE_ID.INTERNAL_ERROR,
    });
  }

  private async sendProductSms(
    mobile: string,
    product: SmsProduct,
    leadId?: bigint | null,
    replacements?: Record<string, string>,
    options?: { templateId?: string; throwOnFailure?: boolean },
  ): Promise<void> {
    const template = options?.templateId
      ? await this.prisma.client.smsTemplate.findFirst({
          where: { templateId: options.templateId, isActive: true },
        })
      : await this.prisma.client.smsTemplate.findFirst({
          where: { product, isActive: true },
        });
    if (!template) {
      const message = options?.templateId
        ? `Active SMS template not configured for templateId=${options.templateId}.`
        : `Active SMS template not configured for product=${product}.`;
      if (options?.throwOnFailure) {
        throw new Error(message);
      }
      this.logger.warn(`[sms] ${message}`);
      return;
    }

    let text = template.message;
    if (replacements) {
      for (const [placeholder, value] of Object.entries(replacements)) {
        text = text.split(placeholder).join(value);
      }
    }

    if (!shouldDeliverSmsViaApi()) {
      const isDev = (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';
      if (isDev || process.env.LOG_SMS_TO_CONSOLE === 'true') {
        // eslint-disable-next-line no-console
        console.log(
          `[sms] product=${template.product} templateId=${template.templateId} to=****${mobile.slice(-4)} message=${text}`,
        );
      }
      return;
    }

    if (!this.smsVendor.isConfigured()) {
      const message = 'SMS gateway is not configured.';
      if (options?.throwOnFailure) {
        throw new Error(message);
      }
      this.logger.warn(`[sms] ${message} product=${template.product} to=****${mobile.slice(-4)}`);
      return;
    }

    const result = await this.smsVendor.send({
      mobile,
      text,
      template,
      leadId,
    });

    if (!result.configured || !result.ok) {
      const message =
        result.skipReason
        ?? `SMS gateway request failed with status ${result.httpStatus ?? 'unknown'}.`;
      if (options?.throwOnFailure) {
        throw new Error(message);
      }
      this.logger.error(`[sms] ${message} product=${template.product} to=****${mobile.slice(-4)}`);
    }
  }
}
