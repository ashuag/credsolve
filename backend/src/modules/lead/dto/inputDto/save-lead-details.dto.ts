import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf
} from 'class-validator';

const LEAD_GENDER_VALUES = ['male', 'female', 'others'] as const;
const LEAD_OCCUPATION_VALUES = [
  'salaried',
  'self_employed_professional',
  'self_employed_business',
  'student',
  'homemaker',
  'retired'
] as const;
const SELF_EMPLOYED_OCCUPATIONS = ['self_employed_professional', 'self_employed_business'] as const;

function normalizeOptionalNumericValue(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/\D/g, '').slice(0, 12);
}

function normalizeOptionalTextValue(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();
  return normalizedValue || undefined;
}

export class SaveLeadDetailsDto {
  @ApiPropertyOptional({ example: 'd47cfc0c-8e5b-4f5a-aa05-cab8d351ab36' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUUID('4', { message: 'leadUuid must be a valid UUID.' })
  leadUuid?: string;

  @ApiProperty({ example: 'Saurabh Sharma' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: 'fullName must be at least 2 characters long.' })
  @MaxLength(100, { message: 'fullName must be at most 100 characters long.' })
  fullName!: string;

  @ApiProperty({ example: '1995-08-17' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dob must be in YYYY-MM-DD format.' })
  dob!: string;

  @ApiProperty({ enum: LEAD_GENDER_VALUES, example: 'male' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(LEAD_GENDER_VALUES, { message: 'gender must be a supported value.' })
  gender!: typeof LEAD_GENDER_VALUES[number];

  @ApiProperty({ enum: LEAD_OCCUPATION_VALUES, example: 'salaried' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(LEAD_OCCUPATION_VALUES, { message: 'occupation must be a supported value.' })
  occupation!: typeof LEAD_OCCUPATION_VALUES[number];

  @ApiProperty({ example: 'Flat 402, Palm Residency, MG Road' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5, { message: 'addressLine1 must be at least 5 characters long.' })
  @MaxLength(255, { message: 'addressLine1 must be at most 255 characters long.' })
  addressLine1!: string;

  @ApiPropertyOptional({ example: 'Near Central Park' })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalTextValue(value))
  @IsString()
  @MaxLength(255, { message: 'addressLine2 must be at most 255 characters long.' })
  addressLine2?: string;

  @ApiProperty({ example: 'Mumbai' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: 'currentCity must be at least 2 characters long.' })
  @MaxLength(100, { message: 'currentCity must be at most 100 characters long.' })
  currentCity!: string;

  @ApiProperty({ example: '400001' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '').slice(0, 6) : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be a valid 6-digit pincode.' })
  pincode!: string;

  @ApiPropertyOptional({ example: '65000' })
  @ValidateIf(({ occupation }) => occupation === 'salaried')
  @Transform(({ value }) => normalizeOptionalNumericValue(value))
  @IsString()
  @Matches(/^\d+$/, { message: 'monthlyIncome must be a valid amount.' })
  monthlyIncome?: string;

  @ApiPropertyOptional({ example: '1200000' })
  @ValidateIf(({ occupation }) => SELF_EMPLOYED_OCCUPATIONS.includes(occupation))
  @Transform(({ value }) => normalizeOptionalNumericValue(value))
  @IsString()
  @Matches(/^\d+$/, { message: 'annualTurnover must be a valid amount.' })
  annualTurnover?: string;

  @ApiPropertyOptional({ example: '300000' })
  @ValidateIf(({ occupation }) => SELF_EMPLOYED_OCCUPATIONS.includes(occupation))
  @Transform(({ value }) => normalizeOptionalNumericValue(value))
  @IsString()
  @Matches(/^\d+$/, { message: 'annualProfit must be a valid amount.' })
  annualProfit?: string;

  @ApiProperty({ example: true })
  @Transform(({ value }) => value === true || value === 'true')
  @Equals(true, { message: 'creditConsentAccepted must be accepted.' })
  creditConsentAccepted!: true;
}
