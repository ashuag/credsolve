import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, MinLength, Min } from 'class-validator';
import {
  PERSON_NAME_PATTERN,
  PERSON_NAME_VALIDATION_MESSAGE,
} from '../../../../common/utils/person-name.util';

const GENDERS = ['MALE', 'FEMALE', 'OTHERS'] as const;
const OCCUPATIONS = [
  'SALARIED',
  'SELF_EMPLOYED_PROFESSIONAL',
  'SELF_EMPLOYED_BUSINESS',
  'STUDENT',
  'HOMEMAKER',
  'RETIRED',
] as const;

export class VerifyPanDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the customer’s active lead when omitted.' })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @ApiProperty({ example: 'ABCDE1234F', description: '10-character PAN' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, { message: 'Invalid PAN format.' })
  panNumber!: string;

  @ApiProperty({
    description: 'Full name as per PAN card, as entered by the user (matched against vendor response).',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_VALIDATION_MESSAGE })
  fullName!: string;

  @ApiProperty({ description: 'Date of birth as YYYY-MM-DD (stored on lead detail for this step).' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dob!: string;

  @ApiProperty({ enum: GENDERS, description: 'Persisted as gender_id on lead_detail.' })
  @IsIn(GENDERS)
  gender!: (typeof GENDERS)[number];

  @ApiProperty({ enum: OCCUPATIONS, description: 'Persisted as occupation_id on lead_detail.' })
  @IsIn(OCCUPATIONS)
  occupation!: (typeof OCCUPATIONS)[number];

  @ApiProperty({
    description:
      'User accepts credit bureau consent; persisted as `lead_detail.cibil_consent_at` (required for bureau soft-pull after PAN).',
  })
  @IsBoolean()
  @Equals(true, { message: 'Credit consent must be accepted to continue.' })
  creditConsentAccepted!: boolean;

  @ApiPropertyOptional({ description: 'Monthly income (digits); persisted on lead_detail when sent.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\d*$/)
  monthlyIncome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\d*$/)
  annualTurnover?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\d*$/)
  annualProfit?: string;

  @ApiPropertyOptional({
    description:
      'Optional when address was saved via POST /auth/lead-details immediately before this call.',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  currentCity?: string;

  @ApiPropertyOptional({ description: 'Preferred when the user picked a row from GET /lookup/cities.' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    return Number.isFinite(n) ? n : undefined;
  })
  @IsInt()
  @Min(1)
  currentCityId?: number;

  @ApiPropertyOptional({ example: '400001' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pincode?: string;
}
