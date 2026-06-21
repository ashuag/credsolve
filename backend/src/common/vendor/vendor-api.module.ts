import { Global, Module } from '@nestjs/common';
import { BureauFetchService } from './bureau-fetch.service';
import { BankTenacioVendorService } from './bank-tenacio-vendor.service';
import { DigilockerVendorService } from './digilocker-vendor.service';
import { LivenessVendorService } from './liveness-vendor.service';
import { KycTenacioVendorService } from './kyc-tenacio-vendor.service';
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
  providers: [VendorApiService, PanVerificationService, BureauFetchService, DigilockerVendorService, LivenessVendorService, BankTenacioVendorService, KycTenacioVendorService],
  exports: [VendorApiService, PanVerificationService, BureauFetchService, DigilockerVendorService, LivenessVendorService, BankTenacioVendorService, KycTenacioVendorService],
})
export class VendorApiModule {}
