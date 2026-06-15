import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { IFSC_CODE_LENGTH, IFSC_CODE_PATTERN } from '../../../../common/constants/application.constants';

export class SubmitVerifiedBankDto {
  @ApiProperty({ description: 'Bank account number (9–18 digits)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^\d{9,18}$/)
  accountNumber!: string;

  @ApiProperty({ description: 'Must match accountNumber (re-entered by customer)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^\d{9,18}$/)
  confirmAccountNumber!: string;

  @ApiProperty({ description: 'IFSC code (11 characters)', example: 'HDFC0001234' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(IFSC_CODE_LENGTH, IFSC_CODE_LENGTH)
  @Matches(new RegExp(IFSC_CODE_PATTERN))
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
