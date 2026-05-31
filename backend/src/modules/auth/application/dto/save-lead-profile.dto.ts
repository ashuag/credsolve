import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
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

export class SaveLeadProfileDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_VALIDATION_MESSAGE })
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
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i)
  panNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  creditConsentAccepted?: boolean;

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
}
