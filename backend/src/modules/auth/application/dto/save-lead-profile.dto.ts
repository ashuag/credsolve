import { GENDER_KEYS } from '../../../../common/constants/gender.constants';
import { OCCUPATION_KEYS } from '../../../../common/constants/occupation.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import {
  PERSON_NAME_PATTERN,
  PERSON_NAME_VALIDATION_MESSAGE,
} from '../../../../common/utils/person-name.util';

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

  @ApiProperty({ enum: GENDER_KEYS })
  @IsIn(GENDER_KEYS)
  gender!: (typeof GENDER_KEYS)[number];

  @ApiProperty({ enum: OCCUPATION_KEYS })
  @IsIn(OCCUPATION_KEYS)
  occupation!: (typeof OCCUPATION_KEYS)[number];

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
