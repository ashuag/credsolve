import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, Matches } from 'class-validator';

const OCCUPATIONS = [
  'salaried',
  'self_employed_professional',
  'self_employed_business',
  'student',
  'homemaker',
  'retired',
] as const;

export class SaveProfessionalDetailsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @ApiProperty({ enum: OCCUPATIONS })
  @IsIn(OCCUPATIONS)
  occupation!: (typeof OCCUPATIONS)[number];

  @ApiPropertyOptional()
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
}
