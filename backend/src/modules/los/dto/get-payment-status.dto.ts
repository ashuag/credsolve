import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

/** Request body for the LOS developer Easebuzz get-payment-status tool. */
export class GetPaymentStatusDto {
  @ApiProperty({
    example: 'MCASH1234172551234567',
    description: 'Easebuzz merchant txnid (max 40 chars), stored on loan_repayment.vendor_ref',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 40)
  txnid!: string;
}
