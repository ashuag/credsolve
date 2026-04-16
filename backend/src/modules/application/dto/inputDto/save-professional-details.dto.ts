import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const OCCUPATION_VALUES = [
  'salaried',
  'self_employed_professional',
  'self_employed_business',
  'student',
  'homemaker',
  'retired'
] as const;

export class SaveProfessionalDetailsDto {
  @ApiPropertyOptional({ example: 'b3f1e2d4-8c9a-4b7e-a1f0-3d2c5e6f7a8b' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  leadUuid?: string;

  @ApiProperty({ example: 'salaried', enum: OCCUPATION_VALUES })
  @IsIn(OCCUPATION_VALUES)
  occupation!: typeof OCCUPATION_VALUES[number];

  @ApiPropertyOptional({ example: '50000' })
  @IsOptional()
  @Matches(/^\d+(\.\d+)?$/, { message: 'monthlyIncome must be a numeric value' })
  monthlyIncome?: string;

  @ApiPropertyOptional({ example: '1200000' })
  @IsOptional()
  @Matches(/^\d+(\.\d+)?$/, { message: 'annualTurnover must be a numeric value' })
  annualTurnover?: string;

  @ApiPropertyOptional({ example: '300000' })
  @IsOptional()
  @Matches(/^\d+(\.\d+)?$/, { message: 'annualProfit must be a numeric value' })
  annualProfit?: string;
}
