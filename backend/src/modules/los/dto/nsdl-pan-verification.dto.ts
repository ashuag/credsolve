import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, Length, Matches } from 'class-validator';

/** Request body for the LOS developer Tenacio NSDL PAN verification tool. */
export class NsdlPanVerificationDto {
  @ApiProperty({ example: 'ABCDE1234F' })
  @IsString()
  @Matches(/^[A-Za-z]{5}\d{4}[A-Za-z]$/, { message: 'panNumber must be a valid PAN (e.g. ABCDE1234F)' })
  panNumber!: string;

  @ApiProperty({ example: 'Rahul Sharma', description: 'Full name as per PAN' })
  @IsString()
  @Length(2, 120)
  fullName!: string;

  @ApiProperty({ example: '1990-05-15', description: 'Date of birth as YYYY-MM-DD' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiPropertyOptional({ example: true, description: 'Customer consent for NSDL PAN verification (defaults to true)' })
  @IsOptional()
  @IsBoolean()
  consent?: boolean;
}
