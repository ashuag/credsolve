import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { WafMiddleware } from './waf.middleware';

/**
 * Application-layer WAF (URL / query / header / limited body inspection).
 * Enable with `WAF_ENABLED=true` (default on). Set `WAF_MODE=log` to observe without blocking.
 */
@Module({})
export class WafModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(WafMiddleware)
      .exclude(
        { path: 'docs', method: RequestMethod.ALL },
        { path: 'docs/(.*)', method: RequestMethod.ALL },
        { path: 'health', method: RequestMethod.ALL },
        { path: 'api/health', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
