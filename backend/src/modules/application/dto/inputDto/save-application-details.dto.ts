import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

function normalizeOptionalTextValue(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();
  return normalizedValue || undefined;
}

export class SaveApplicationDetailsDto {
  @ApiPropertyOptional({ example: 'b3f1e2d4-8c9a-4b7e-a1f0-3d2c5e6f7a8b' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  leadUuid?: string;

  @ApiProperty({ example: 'Saurabh Kumar' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'male', enum: ['male', 'female', 'others'] })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(['male', 'female', 'others'])
  gender!: string;

  @ApiProperty({ example: '1995-07-20', description: 'YYYY-MM-DD' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dob must be in YYYY-MM-DD format' })
  dob!: string;

  get dateOfBirth(): Date {
    const [year, month, day] = this.dob.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  @ApiProperty({ example: 'ABCDE1234F' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'panNumber must be a valid PAN (e.g. ABCDE1234F)' })
  panNumber!: string;

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
}
