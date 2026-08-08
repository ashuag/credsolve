import { Global, Module } from '@nestjs/common';
import { KycFilesService } from '../kyc/kyc-files.service';
import { KycSelfieFaceValidationService } from '../kyc/kyc-selfie-face-validation.service';
import { KycFaceMatchService } from '../kyc/kyc-face-match.service';
import { KycPhotoVerificationService } from '../kyc/kyc-photo-verification.service';
import { SpacesObjectStorageService } from './spaces-object-storage.service';

const KYC_PROVIDERS = [
  SpacesObjectStorageService,
  KycFilesService,
  KycSelfieFaceValidationService,
  KycFaceMatchService,
  KycPhotoVerificationService,
];

@Global()
@Module({
  providers: KYC_PROVIDERS,
  exports: KYC_PROVIDERS,
})
export class StorageModule {}
