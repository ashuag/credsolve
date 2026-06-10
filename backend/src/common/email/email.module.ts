import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ZeptomailEmailVendorService } from './zeptomail-email-vendor.service';

@Module({
  providers: [EmailService, ZeptomailEmailVendorService],
  exports: [EmailService],
})
export class EmailModule {}
