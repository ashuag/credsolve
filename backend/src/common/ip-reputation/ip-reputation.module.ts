import { Global, Module } from '@nestjs/common';
import { IpReputationService } from './ip-reputation.service';
import { VpnBlockGuard } from './vpn-block.guard';

/**
 * Global so any controller can attach `VpnBlockGuard` via `@UseGuards(...)`
 * and inject `IpReputationService` without re-importing.
 */
@Global()
@Module({
  providers: [IpReputationService, VpnBlockGuard],
  exports: [IpReputationService, VpnBlockGuard],
})
export class IpReputationModule {}
