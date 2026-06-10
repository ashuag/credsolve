import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { IFSC_CODE_LENGTH, IFSC_CODE_PATTERN } from '../../../../common/constants/application.constants';

export class SaveBankDetailsDto {
  @ApiProperty({ description: 'Bank account number' })
  @IsString()
  @Matches(/^\d{9,18}$/)
  accountNumber!: string;

  @ApiProperty({ description: 'IFSC code (11 characters, e.g. HDFC0001234)', example: 'HDFC0001234' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(IFSC_CODE_LENGTH, IFSC_CODE_LENGTH)
  @Matches(new RegExp(IFSC_CODE_PATTERN))
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

