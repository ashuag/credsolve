import { Module } from '@nestjs/common';
import { SurepassCibilService } from './surepass-cibil.service';

/**
 * Surepass CIBIL integration (backup vendor for the `cibil_fetch` API).
 *
 * `SurepassCibilService` resolves its `VendorApiService` dependency from the
 * global `VendorApiModule`, which imports this module and re-exports the
 * service so `BureauFetchService` can switch vendors via `vendor_api_config`.
 */
@Module({
  providers: [SurepassCibilService],
  exports: [SurepassCibilService],
})
export class SurepassCibilModule {}
