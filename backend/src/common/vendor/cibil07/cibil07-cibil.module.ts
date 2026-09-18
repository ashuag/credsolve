import { Module } from '@nestjs/common';
import { Cibil07CibilService } from './cibil07-cibil.service';

/**
 * CIBIL07 CIBIL integration (selectable `cibil_fetch` vendor).
 *
 * `Cibil07CibilService` resolves its `VendorApiService` / `PrismaService`
 * dependencies from the global providers; `VendorApiModule` imports this module
 * and re-exports the service so `BureauFetchService` can switch vendors via
 * `vendor_api_config`.
 */
@Module({
  providers: [Cibil07CibilService],
  exports: [Cibil07CibilService],
})
export class Cibil07CibilModule {}
