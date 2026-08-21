import { OCCUPATION_KEYS } from '../../../../common/constants/occupation.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, Matches } from 'class-validator';

export class SaveProfessionalDetailsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @ApiProperty({ enum: OCCUPATION_KEYS })
  @IsIn(OCCUPATION_KEYS)
  occupation!: (typeof OCCUPATION_KEYS)[number];

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
