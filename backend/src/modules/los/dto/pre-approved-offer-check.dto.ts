import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class PreApprovedOfferCheckDto {
  @ApiProperty({
    description: 'Full Tenacio bureau vendor response JSON (same shape stored in bureau_report.raw_payload)',
  })
  @IsObject()
  bureauPayload!: Record<string, unknown>;
}
