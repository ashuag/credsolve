import { Global, Module } from '@nestjs/common';
import { KycFilesService } from '../kyc/kyc-files.service';
import { SpacesObjectStorageService } from './spaces-object-storage.service';

@Global()
@Module({
  providers: [SpacesObjectStorageService, KycFilesService],
  exports: [SpacesObjectStorageService, KycFilesService],
})
export class StorageModule {}
