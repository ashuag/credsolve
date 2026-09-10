import { Module } from '@nestjs/common';
import { MyMoneyBazaarCibilService } from './mymoneybazaar-cibil.service';

/**
 * MyMoneyBazaar CIBIL integration (selectable `cibil_fetch` vendor).
 *
 * `MyMoneyBazaarCibilService` resolves its `VendorApiService` / `PrismaService`
 * dependencies from the global providers; `VendorApiModule` imports this module
 * and re-exports the service so `BureauFetchService` can switch vendors via
 * `vendor_api_config`.
 */
@Module({
  providers: [MyMoneyBazaarCibilService],
  exports: [MyMoneyBazaarCibilService],
})
export class MyMoneyBazaarCibilModule {}
