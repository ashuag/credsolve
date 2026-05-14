import { BadRequestException } from '@nestjs/common';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';

export function assertApplicationKycNotCompleted(kycStatus: number | null | undefined): void {
  if (kycStatus === APPLICATION_KYC_STATUS.COMPLETED) {
    throw new BadRequestException('KYC is already completed for this application.');
  }
}
