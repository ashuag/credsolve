import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

const GENDERS = ['male', 'female', 'others'] as const;
const OCCUPATIONS = [
  'salaried',
  'self_employed_professional',
  'self_employed_business',
  'student',
  'homemaker',
  'retired',
] as const;

export class SaveLeadDetailsDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the customer’s active lead when omitted.' })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ description: 'Date of birth as YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dob!: string;

  @ApiProperty({ enum: GENDERS })
  @IsIn(GENDERS)
  gender!: (typeof GENDERS)[number];

  @ApiProperty({ enum: OCCUPATIONS })
  @IsIn(OCCUPATIONS)
  occupation!: (typeof OCCUPATIONS)[number];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine2?: string;

  @ApiProperty({
    description: 'City name from lookup, or "City, ST" when editing an existing profile',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentCity!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{6}$/)
  pincode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  monthlyIncome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  annualTurnover?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  annualProfit?: string;

  @ApiProperty()
  @IsBoolean()
  creditConsentAccepted!: boolean;

  @ApiPropertyOptional({ description: '10-character PAN (optional if already verified earlier).' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i)
  panNumber?: string;
}
