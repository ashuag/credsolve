import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsVendorService } from './sms-vendor.service';
import { SmsDlrWebhookService } from './sms-dlr-webhook.service';
import { SmsWebhookController } from './sms-webhook.controller';

@Global()
@Module({
  controllers: [SmsWebhookController],
  providers: [SmsService, SmsVendorService, SmsDlrWebhookService],
  exports: [SmsService, SmsVendorService, SmsDlrWebhookService],
})
export class SmsModule {}
