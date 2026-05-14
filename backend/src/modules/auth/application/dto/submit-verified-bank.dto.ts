import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SubmitVerifiedBankDto {
  @IsString()
  @Matches(/^\d{9,18}$/)
  accountNumber!: string;

  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/i)
  ifscCode!: string;

  /** Display name from IFSC lookup (`data.bankName`); stored on disbursement when penny-drop succeeds. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 &.'(),/-]{1,99}$/)
  verifiedBankName?: string;
}
