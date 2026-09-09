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
   * Easebuzz Pay Now server-to-server notify URL (original).
   * Easebuzz calls the public customer origin (not api.moneycash.in):
   *   https://moneycash.in/api/webhooks/easebuzz/repayment
   * Customer Next forwards the same payload to Nest /api/webhooks/easebuzz/repayment.
   * EasyCollect payloads posted here are also accepted.
   */
  @All('repayment')
  @HttpCode(200)
  @ApiOperation({ summary: 'Easebuzz Pay webhook — settle repayment without a browser redirect' })
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.respond(req, res, {
      requestPath: '/api/webhooks/easebuzz/repayment',
      serviceName: 'pay-webhook',
      execute: (payload) => this.callback.executeWebhook(payload),
    });
  }

  /**
   * Easebuzz EasyCollect server-to-server notify URL (dashboard / SMS payment links).
   *   https://moneycash.in/api/webhooks/easebuzz/easycollect
   * Does not replace /webhooks/easebuzz/repayment — configure this separately in Easebuzz.
   */
  @All('easycollect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Easebuzz EasyCollect webhook — settle collection-link repayments' })
  async handleEasyCollect(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.respond(req, res, {
      requestPath: '/api/webhooks/easebuzz/easycollect',
      serviceName: 'easycollect-webhook',
      execute: (payload) => this.callback.executeEasyCollectWebhook(payload),
    });
  }

  private async respond(
    req: Request,
    res: Response,
    opts: {
      requestPath: string;
      serviceName: string;
      execute: (payload: Record<string, unknown>) => Promise<{
        httpStatus: number;
        body: Record<string, unknown>;
      }>;
    },
  ): Promise<void> {
    const requestedAt = new Date();
    const payload = mergeCallbackPayload(req);
    const method = (req.method ?? 'POST').toUpperCase() as VendorHttpMethod;
    let httpStatus = 200;
    let body: Record<string, unknown> = { ok: false, result: 'error', code: 'unhandled' };

    try {
      const out = await opts.execute(payload);
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
        `[repay-webhook] Unhandled error path=${opts.requestPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    await this.vendorApi.auditOutboundCall({
      providerName: 'Easebuzz',
      serviceName: opts.serviceName,
      requestMethod: method === 'GET' || method === 'POST' ? method : 'POST',
      requestPath: opts.requestPath,
      requestPayload: payload,
      responsePayload: body,
      httpStatus,
      requestedAt,
      respondedAt: new Date(),
    });

    res.status(httpStatus).json(body);
  }
}
