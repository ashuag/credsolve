import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

/** Shared request body for the LOS developer CIBIL vendor fetch tools. */
export class CibilVendorFetchCheckDto {
  @ApiProperty({ example: '9876543210', description: '10-digit mobile number registered with the bureau' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'mobileNumber must be a 10-digit number' })
  mobileNumber!: string;

  @ApiProperty({ example: 'ABCDE1234F' })
  @IsString()
  @Matches(/^[A-Za-z]{5}\d{4}[A-Za-z]$/, { message: 'panNumber must be a valid PAN (e.g. ABCDE1234F)' })
  panNumber!: string;

  @ApiProperty({ example: 'Rahul Sharma', description: 'Full name as per PAN' })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({ example: true, description: 'Customer consent for the bureau pull (defaults to true)' })
  @IsOptional()
  @IsBoolean()
  consent?: boolean;

  @ApiPropertyOptional({
    example: 'male',
    enum: ['male', 'female'],
    description: 'Required by Surepass; ignored by Tenacio.',
  })
  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: 'male' | 'female';
}
