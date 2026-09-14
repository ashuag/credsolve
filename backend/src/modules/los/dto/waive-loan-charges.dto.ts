import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class WaiveLoanChargesDto {
  @ApiProperty({
    example: 500,
    minimum: 0,
    description:
      'Amount of penal + overdue-days interest to waive. Cannot exceed the current negotiable charges.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  waivedAmountInr!: number;
}
