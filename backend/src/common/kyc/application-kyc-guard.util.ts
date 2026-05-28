import { BadRequestException } from '@nestjs/common';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';

export function assertApplicationKycNotCompleted(kycStatus: number | null | undefined): void {
  if (kycStatus === APPLICATION_KYC_STATUS.COMPLETED) {
    throw new BadRequestException('KYC is already completed for this application.');
  }
  if (kycStatus === APPLICATION_KYC_STATUS.FAILED) {
    throw new BadRequestException(
      'KYC verification failed for this application. Name or date of birth did not match Aadhaar.',
    );
  }
}
