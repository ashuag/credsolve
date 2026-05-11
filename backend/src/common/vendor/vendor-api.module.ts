import { Global, Module } from '@nestjs/common';
import { VendorApiService } from './vendor-api.service';

/**
 * Generic 3rd-party API caller with audit logging.
 *
 * `@Global()` so any feature module can inject `VendorApiService` without
 * having to add `VendorApiModule` to its `imports[]` (matches the pattern
 * used by `PrismaModule` and `RedisModule`). Wire it up once in
 * `AppModule.imports`.
 */
@Global()
@Module({
  providers: [VendorApiService],
  exports: [VendorApiService],
})
export class VendorApiModule {}
