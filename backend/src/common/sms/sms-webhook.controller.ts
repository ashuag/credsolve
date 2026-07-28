import { Controller, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { SmsDlrWebhookService } from './sms-dlr-webhook.service';

@ApiExcludeController()
@Controller('webhooks/sms')
export class SmsWebhookController {
  constructor(private readonly dlrWebhook: SmsDlrWebhookService) {}

  /**
   * SMS gateway delivery report (DLR) callback.
   * Full URL: POST /api/webhooks/sms/dlr
   * Auth: header `x-sms-webhook-secret` or query `?secret=` matching SMS_DLR_WEBHOOK_SECRET.
   *
   * Reads `req.body` directly so the global ValidationPipe does not strip
   * gateway fields before we persist the full DLR payload.
   */
  @Post('dlr')
  @HttpCode(200)
  async handleDlr(@Req() req: Request, @Query('secret') querySecret?: string) {
    const headerSecret = req.header('x-sms-webhook-secret') ?? undefined;
    this.dlrWebhook.assertAuthorized(headerSecret?.trim() || querySecret?.trim());
    const result = await this.dlrWebhook.handleDeliveryReport(req.body);
    return { ok: true, ...result };
  }
}
