import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsTemplate } from '@prisma/client';
import { VendorApiService } from '../vendor/vendor-api.service';
import { resolveSmsApiUrl, resolveSmsProviderName } from './sms-env.util';

export type SmsGatewayRequestBody = {
  from: string;
  to: string;
  text: string;
  type: string;
  product: string;
  template_id: string;
  entity_id: string;
};

export type SmsVendorSendInput = {
  mobile: string;
  text: string;
  template: Pick<SmsTemplate, 'templateId' | 'bearerToken' | 'product'>;
  leadId?: bigint | null;
};

function maskOtpInText(text: string): string {
  return text.replace(/\d{4,8}/g, (match) => `${match.slice(0, 2)}****`);
}

export type SmsVendorSendResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
};

@Injectable()
export class SmsVendorService {
  constructor(
    private readonly config: ConfigService,
    // `forwardRef` breaks the SMS<->Vendor module cycle:
    // VendorApiService -> VendorInternalErrorService -> SmsService ->
    // SmsVendorService -> VendorApiService.
    @Inject(forwardRef(() => VendorApiService))
    private readonly vendorApi: VendorApiService,
  ) {}

  isConfigured(): boolean {
    return Boolean(resolveSmsApiUrl(this.config));
  }

  async send(input: SmsVendorSendInput): Promise<SmsVendorSendResult> {
    const apiUrl = resolveSmsApiUrl(this.config);
    if (!apiUrl) {
      return {
        ok: false,
        configured: false,
        httpStatus: null,
        skipReason: 'SMS_API_URL (or SMS_URL) is not configured',
      };
    }

    const from = this.config.get<string>('SMS_FROM')?.trim() || 'CREDPT';
    const entityId = this.config.get<string>('SMS_ENTITY_ID')?.trim() || '1001073383071918075';
    const messageType = this.config.get<string>('SMS_TYPE')?.trim() || 'N';
    const providerName = resolveSmsProviderName(this.config);

    const body: SmsGatewayRequestBody = {
      from,
      to: input.mobile,
      text: input.text,
      type: messageType,
      product: input.template.product,
      template_id: input.template.templateId,
      entity_id: entityId,
    };

    const result = await this.vendorApi.request<unknown, SmsGatewayRequestBody>({
      providerName,
      serviceName: `sms-${input.template.product.toLowerCase()}`.slice(0, 120),
      method: 'POST',
      absoluteUrl: apiUrl,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.template.bearerToken}`,
      },
      body,
      leadId: input.leadId ?? null,
      redactRequest: (payload) => ({
        ...payload,
        text: payload?.text ? maskOtpInText(payload.text) : payload?.text,
      }),
    });

    return {
      configured: true,
      ok: result.ok,
      httpStatus: result.httpStatus,
    };
  }
}
