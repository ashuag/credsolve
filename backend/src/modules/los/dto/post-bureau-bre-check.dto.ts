import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class PostBureauBreCheckDto {
  @ApiProperty({
    description: 'Full Tenacio bureau vendor response JSON (same shape stored in bureau_report.raw_payload)',
  })
  @IsObject()
  bureauPayload!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'When true, applies cibil_min_existing instead of cibil_min_new',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isExistingCustomer?: boolean;
}
