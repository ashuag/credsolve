import { BadRequestException } from '@nestjs/common';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
import { isDigilockerAadhaarCaptureComplete } from './aadhaar-vendor-parse.util';
import { isActiveLivenessDisabled } from './kyc-active-liveness.util';

export type ApplicationFaceStepSnapshot = {
  kycStatus?: number | null;
  selfieRelativePath?: string | null;
  livenessPassed?: boolean | null;
  digilockerAadhaarFormJson?: unknown;
};

export function isApplicationFaceStepComplete(application: ApplicationFaceStepSnapshot): boolean {
  const hasSelfie = Boolean(application.selfieRelativePath?.trim());
  const hasAadhaar = isDigilockerAadhaarCaptureComplete(application.digilockerAadhaarFormJson ?? null);
  const livenessOk = application.livenessPassed === true || isActiveLivenessDisabled();
  return hasAadhaar && hasSelfie && livenessOk;
}

/** Blocks when the full face step (Aadhaar + selfie + liveness when required) is done. */
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
