import { Module } from '@nestjs/common';
import { SurepassDigilockerService } from './surepass-digilocker.service';

/**
 * Surepass DigiLocker integration (primary vendor for `kyc_digilocker`).
 *
 * `SurepassDigilockerService` resolves `VendorApiService` from the global
 * `VendorApiModule`, which imports this module and re-exports the service.
 */
@Module({
  providers: [SurepassDigilockerService],
  exports: [SurepassDigilockerService],
})
export class SurepassDigilockerModule {}
