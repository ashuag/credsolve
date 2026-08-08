import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  inspectRequestForWaf,
  isWafBlockMode,
  isWafEnabled,
  WAF_BLOCKED_CODE,
} from './waf.rules';

@Injectable()
export class WafMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WafMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    if (!isWafEnabled(process.env.WAF_ENABLED)) {
      next();
      return;
    }

    const queryIndex = req.originalUrl.indexOf('?');
    const queryString = queryIndex >= 0 ? req.originalUrl.slice(queryIndex + 1) : undefined;

    const hit = inspectRequestForWaf({
      method: req.method,
      originalUrl: req.originalUrl,
      queryString,
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body,
    });

    if (!hit) {
      next();
      return;
    }

    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.ip ||
      'unknown';

    this.logger.warn(
      `WAF hit rule=${hit.ruleId} field=${hit.field} ip=${ip} method=${req.method} url=${req.originalUrl} detail=${hit.detail}`,
    );

    if (!isWafBlockMode(process.env.WAF_MODE)) {
      next();
      return;
    }

    res.status(403).json({
      statusCode: 403,
      code: WAF_BLOCKED_CODE,
      message: 'Request blocked by security policy.',
      ruleId: hit.ruleId,
    });
  }
}
