import { Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { SmsDlrWebhookService } from './sms-dlr-webhook.service';
import type { SmsDlrWebhookPayload } from './sms-dlr.types';

function payloadFromQuery(query: Record<string, string | undefined>): SmsDlrWebhookPayload {
  return {
    message_id: query.message_id ?? null,
    service: query.service ?? null,
    sender: query.sender ?? null,
    mobile: query.mobile ?? null,
    status: query.status ?? null,
    code: query.code ?? null,
    submit_at: query.submit_at ?? null,
    dlr_received_at: query.dlr_received_at ?? null,
    entity_id: query.entity_id ?? null,
    template_id: query.template_id ?? null,
    units: query.units ?? null,
    correlation_id: query.correlation_id ?? null,
  };
}

@ApiExcludeController()
@Controller('webhooks/sms')
export class SmsWebhookController {
  constructor(private readonly dlrWebhook: SmsDlrWebhookService) {}

  /**
   * SMS gateway delivery report (DLR) — GET + query params.
   * Example: GET /api/webhooks/sms/dlr?message_id=...&status=DELIVRD&code=000&...
   */
  @Get('dlr')
  async handleDlrGet(@Query() query: Record<string, string | undefined> = {}) {
    const result = await this.dlrWebhook.handleDeliveryReport(payloadFromQuery(query));
    return { ok: true, ...result };
  }

  /**
   * SMS gateway delivery report (DLR) — POST + JSON body.
   * Example: POST /api/webhooks/sms/dlr
   */
  @Post('dlr')
  @HttpCode(200)
  async handleDlrPost(@Req() req: Request) {
    const result = await this.dlrWebhook.handleDeliveryReport(req.body);
    return { ok: true, ...result };
  }
}
