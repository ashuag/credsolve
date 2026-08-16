import { Module } from '@nestjs/common';
import { SurepassFaceLivenessService } from './surepass-face-liveness.service';

/**
 * Surepass face-liveness integration (`POST /api/v1/face/face-liveness`).
 *
 * `SurepassFaceLivenessService` resolves its `VendorApiService` dependency from the
 * global `VendorApiModule`, which imports this module and re-exports the service.
 */
@Module({
  providers: [SurepassFaceLivenessService],
  exports: [SurepassFaceLivenessService],
})
export class SurepassFaceLivenessModule {}
