import { BadRequestException } from '@nestjs/common';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
import { isDigilockerAadhaarCaptureComplete } from './aadhaar-vendor-parse.util';

export type ApplicationFaceStepSnapshot = {
  kycStatus?: number | null;
  digilockerAadhaarFormJson?: unknown;
};

/** DigiLocker Aadhaar capture completes the KYC face step until selfie/liveness is rewritten. */
export function isApplicationFaceStepComplete(application: ApplicationFaceStepSnapshot): boolean {
  return isDigilockerAadhaarCaptureComplete(application.digilockerAadhaarFormJson ?? null);
}

/** Blocks when DigiLocker Aadhaar KYC is already done. */
export function assertApplicationFaceStepNotComplete(application: ApplicationFaceStepSnapshot): void {
  if (application.kycStatus === APPLICATION_KYC_STATUS.FAILED) {
    throw new BadRequestException(
      'KYC verification failed for this application. Name or date of birth did not match Aadhaar.',
    );
  }
  if (isApplicationFaceStepComplete(application)) {
    throw new BadRequestException('KYC is already completed for this application.');
  }
}

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
