import { Global, Module } from '@nestjs/common';
import { CibilFetchService } from './cibil-fetch.service';
import { PanVerificationService } from './pan-verification.service';
import { VendorApiService } from './vendor-api.service';

/**
 * Generic 3rd-party API caller with audit logging.
 *
 * `@Global()` so any feature module can inject `VendorApiService` and
 * domain-specific vendor services (e.g. `PanVerificationService`) without
 * having to add `VendorApiModule` to its `imports[]` (matches the pattern
 * used by `PrismaModule` and `RedisModule`). Wire it up once in
 * `AppModule.imports`.
 */
@Global()
@Module({
  providers: [VendorApiService, PanVerificationService, CibilFetchService],
  exports: [VendorApiService, PanVerificationService, CibilFetchService],
})
export class VendorApiModule {}
