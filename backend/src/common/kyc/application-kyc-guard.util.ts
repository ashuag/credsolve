import { BadRequestException } from '@nestjs/common';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
import { isDigilockerAadhaarCaptureComplete } from './aadhaar-vendor-parse.util';

export type ApplicationFaceStepSnapshot = {
  kycStatus?: number | null;
  selfieRelativePath?: string | null;
  livenessPassed?: boolean | null;
  digilockerAadhaarFormJson?: unknown;
};

/**
 * Face step is complete only after DigiLocker Aadhaar + selfie + local Aadhaar↔selfie
 * face match (`livenessPassed`). Tenacio outbound skip must not bypass face match.
 */
export function isApplicationFaceStepComplete(application: ApplicationFaceStepSnapshot): boolean {
  const hasSelfie = Boolean(application.selfieRelativePath?.trim());
  const hasAadhaar = isDigilockerAadhaarCaptureComplete(application.digilockerAadhaarFormJson ?? null);
  return hasAadhaar && hasSelfie && application.livenessPassed === true;
}

/** Blocks when the full face step (Aadhaar + selfie + face match) is done. */
export function assertApplicationKycNotFailed(kycStatus: number | null | undefined): void {
  if (kycStatus === APPLICATION_KYC_STATUS.FAILED) {
    throw new BadRequestException(
      'KYC verification failed for this application. Name or date of birth did not match Aadhaar.',
    );
  }
}

export function assertApplicationFaceStepNotComplete(application: ApplicationFaceStepSnapshot): void {
  assertApplicationKycNotFailed(application.kycStatus);
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
