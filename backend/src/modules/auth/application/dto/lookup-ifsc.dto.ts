import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { IFSC_CODE_LENGTH, IFSC_CODE_PATTERN } from '../../../../common/constants/application.constants';

export class LookupIfscDto {
  @ApiProperty({ example: 'HDFC0001234' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(IFSC_CODE_LENGTH, IFSC_CODE_LENGTH)
  @Matches(new RegExp(IFSC_CODE_PATTERN))
  ifscNumber!: string;
}
