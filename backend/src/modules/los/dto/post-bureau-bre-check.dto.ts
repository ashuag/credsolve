import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Applicant mobile for bureau phone-match dry-run (India: 10 digits, optional +91/0). When omitted, phone match is reported as skipped.',
    example: '9876543210',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[\d+\-\s()]*$/, { message: 'applicantMobile must look like a phone number' })
  applicantMobile?: string;
}
