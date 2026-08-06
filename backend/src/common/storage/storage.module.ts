import { Global, Module } from '@nestjs/common';
import { KycFilesService } from '../kyc/kyc-files.service';
import { KycSelfieFaceValidationService } from '../kyc/kyc-selfie-face-validation.service';
import { KycFaceMatchService } from '../kyc/kyc-face-match.service';
import { SpacesObjectStorageService } from './spaces-object-storage.service';

@Global()
@Module({
  providers: [SpacesObjectStorageService, KycFilesService, KycSelfieFaceValidationService, KycFaceMatchService],
  exports: [SpacesObjectStorageService, KycFilesService, KycSelfieFaceValidationService, KycFaceMatchService],
})
export class StorageModule {}
