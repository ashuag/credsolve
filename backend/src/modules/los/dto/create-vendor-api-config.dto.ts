import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateVendorApiConfigDto {
  @ApiProperty({ example: 'cibil_fetch', maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  apiCode!: string;

  @ApiProperty({ example: 'CIBIL fetch', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  apiName!: string;

  @ApiProperty({ example: 'Tenacio', maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  vendorName!: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 99 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  priority?: number;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  status?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
