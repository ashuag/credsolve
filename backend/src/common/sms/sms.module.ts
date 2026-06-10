import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsVendorService } from './sms-vendor.service';

@Global()
@Module({
  providers: [SmsService, SmsVendorService],
  exports: [SmsService, SmsVendorService],
})
export class SmsModule {}
