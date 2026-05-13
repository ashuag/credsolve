import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Equals, IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class CibilTenacioInputDto {
  @ApiProperty({ example: '9876543210', description: 'Borrower mobile (10-digit Indian MSISDN).' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'mobileNumber must be a 10-digit Indian mobile starting with 6–9.' })
  mobileNumber!: string;

  @ApiProperty({ description: 'Full name as sent to the bureau vendor.' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'ABCDE1234F' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, { message: 'Invalid PAN format.' })
  panNumber!: string;

  @ApiProperty({ description: 'Must be true — explicit consent for bureau pull.' })
  @IsBoolean()
  @Equals(true, { message: 'consent must be true.' })
  consent!: boolean;
}

export class FetchCibilDto {
  @ApiProperty({ type: CibilTenacioInputDto })
  @ValidateNested()
  @Type(() => CibilTenacioInputDto)
  input!: CibilTenacioInputDto;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Lead to attach on `vendor_api_log`. Required for LOS callers. For customers, defaults to the active lead when omitted.',
  })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;
}
