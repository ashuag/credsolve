import { Global, Module } from '@nestjs/common';
import { KycFilesService } from '../kyc/kyc-files.service';
import { KycSelfieFaceValidationService } from '../kyc/kyc-selfie-face-validation.service';
import { KycFaceMatchService } from '../kyc/kyc-face-match.service';
import { KycActiveLivenessService } from '../kyc/kyc-active-liveness.service';
import { SpacesObjectStorageService } from './spaces-object-storage.service';

@Global()
@Module({
  providers: [
    SpacesObjectStorageService,
    KycFilesService,
    KycSelfieFaceValidationService,
    KycFaceMatchService,
    KycActiveLivenessService,
  ],
  exports: [
    SpacesObjectStorageService,
    KycFilesService,
    KycSelfieFaceValidationService,
    KycFaceMatchService,
    KycActiveLivenessService,
  ],
})
export class StorageModule {}
