import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SaveBankDetailsDto {
  @ApiProperty({ description: 'Bank account number' })
  @IsString()
  @Matches(/^\d{9,18}$/)
  accountNumber!: string;

  @ApiProperty({ description: 'IFSC code' })
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/i)
  ifscCode!: string;

  @ApiPropertyOptional({
    description: 'Bank name as per master list; omit when customer only provides IFSC + account number.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 &.'(),/-]{1,99}$/)
  bankName?: string;
}

