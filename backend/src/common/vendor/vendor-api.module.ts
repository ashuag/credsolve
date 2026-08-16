import { Global, Module } from '@nestjs/common';
import { EasebuzzWireService } from '../easebuzz/easebuzz-wire.service';
import { BureauFetchService } from './bureau-fetch.service';
import { BankTenacioVendorService } from './bank-tenacio-vendor.service';
import { DigilockerFetchService } from './digilocker-fetch.service';
import { DigilockerVendorService } from './digilocker-vendor.service';
import { KycTenacioVendorService } from './kyc-tenacio-vendor.service';
import { LivenessVendorService } from './liveness-vendor.service';
import { PanVerificationService } from './pan-verification.service';
import { SurepassCibilModule } from './surepass/surepass-cibil.module';
import { SurepassDigilockerModule } from './surepass/surepass-digilocker.module';
import { SurepassFaceLivenessModule } from './surepass/surepass-face-liveness.module';
import { VendorApiService } from './vendor-api.service';
import { VendorApiConfigService } from './vendor-api-config.service';
import { VendorInternalErrorService } from './vendor-internal-error.service';

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
  imports: [SurepassCibilModule, SurepassDigilockerModule, SurepassFaceLivenessModule],
  providers: [
    VendorApiService,
    VendorApiConfigService,
    VendorInternalErrorService,
    PanVerificationService,
    BureauFetchService,
    DigilockerVendorService,
    DigilockerFetchService,
    BankTenacioVendorService,
    LivenessVendorService,
    KycTenacioVendorService,
    EasebuzzWireService,
  ],
  exports: [
    VendorApiService,
    VendorApiConfigService,
    VendorInternalErrorService,
    PanVerificationService,
    BureauFetchService,
    DigilockerVendorService,
    DigilockerFetchService,
    BankTenacioVendorService,
    LivenessVendorService,
    KycTenacioVendorService,
    EasebuzzWireService,
    SurepassCibilModule,
    SurepassDigilockerModule,
    SurepassFaceLivenessModule,
  ],
})
export class VendorApiModule {}
