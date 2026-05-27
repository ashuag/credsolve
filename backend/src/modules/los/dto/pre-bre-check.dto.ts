import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class PreBreCheckDto {
  @ApiProperty({ example: '1990-05-15' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  genderId!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  occupationId!: number;

  @ApiPropertyOptional({ example: 'Male' })
  @IsOptional()
  @IsString()
  genderDisplay?: string;

  @ApiPropertyOptional({ example: 'Salaried' })
  @IsOptional()
  @IsString()
  occupationDisplay?: string;

  @ApiProperty({ example: '110001' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pincode!: string;

  @ApiPropertyOptional({ description: 'City master id for negative-city check' })
  @IsOptional()
  @IsInt()
  @Min(1)
  cityId?: number;

  @ApiPropertyOptional({ description: 'State master id (usually from city)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  stateId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityName?: string;

  @ApiPropertyOptional({ example: 'DL' })
  @IsOptional()
  @IsString()
  stateCode?: string;
}
