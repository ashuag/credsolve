import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class SaveLoanOfferDto {
  @ApiPropertyOptional({ example: 'b3f1e2d4-8c9a-4b7e-a1f0-3d2c5e6f7a8b' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUUID('4', { message: 'leadUuid must be a valid UUID.' })
  leadUuid?: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt({ message: 'reasonForLoanId must be a valid reason id.' })
  @Min(1, { message: 'reasonForLoanId must be a valid reason id.' })
  reasonForLoanId!: number;

  @ApiProperty({ example: 7500 })
  @Type(() => Number)
  @IsInt({ message: 'loanAmount must be a whole number.' })
  @IsPositive({ message: 'loanAmount must be greater than zero.' })
  loanAmount!: number;
}
