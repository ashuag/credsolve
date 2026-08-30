import { All, Controller, HttpCode, Logger, Req, Res } from '@nestjs/common';
import { ApiExcludeController, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { VendorApiService } from '../../../common/vendor/vendor-api.service';
import type { VendorHttpMethod } from '../../../common/constants/vendor-http-method.constants';
import { HandleEasebuzzRepaymentCallbackUseCase } from '../application/use-cases/handle-easebuzz-repayment-callback.use-case';

function mergeCallbackPayload(req: Request): Record<string, unknown> {
  const query =
    typeof req.query === 'object' && req.query ? (req.query as Record<string, unknown>) : {};
  const body = typeof req.body === 'object' && req.body ? (req.body as Record<string, unknown>) : {};
  return { ...query, ...body };
}

@ApiExcludeController()
@Controller('webhooks/easebuzz')
export class EasebuzzRepaymentWebhookController {
  private readonly logger = new Logger(EasebuzzRepaymentWebhookController.name);

  constructor(
    private readonly callback: HandleEasebuzzRepaymentCallbackUseCase,
    private readonly vendorApi: VendorApiService,
  ) {}

  /**
   * Easebuzz Pay server-to-server notify URL.
   * Easebuzz calls the public customer origin (not api.moneycash.in):
   *   https://moneycash.in/api/webhooks/easebuzz/repayment
   * Customer Next forwards the same payload to Nest /api/webhooks/easebuzz/repayment.
   */
  @All('repayment')
  @HttpCode(200)
  @ApiOperation({ summary: 'Easebuzz Pay webhook — settle repayment without a browser redirect' })
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const requestedAt = new Date();
    const payload = mergeCallbackPayload(req);
    const method = (req.method ?? 'POST').toUpperCase() as VendorHttpMethod;
    let httpStatus = 200;
    let body: Record<string, unknown> = { ok: false, result: 'error', code: 'unhandled' };

    try {
      const out = await this.callback.executeWebhook(payload);
      httpStatus = out.httpStatus;
      body = out.body;
    } catch (error) {
      httpStatus = 500;
      body = {
        ok: false,
        result: 'error',
        code: 'webhook_failed',
        message: error instanceof Error ? error.message : 'webhook_failed',
      };
      this.logger.error(
        `[repay-webhook] Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    await this.vendorApi.auditOutboundCall({
      providerName: 'Easebuzz',
      serviceName: 'pay-webhook',
      requestMethod: method === 'GET' || method === 'POST' ? method : 'POST',
      requestPath: '/api/webhooks/easebuzz/repayment',
      requestPayload: payload,
      responsePayload: body,
      httpStatus,
      requestedAt,
      respondedAt: new Date(),
    });

    res.status(httpStatus).json(body);
  }
}
