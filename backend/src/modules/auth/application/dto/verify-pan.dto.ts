import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class VerifyPanDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the customer’s active lead when omitted.' })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @ApiProperty({ example: 'ABCDE1234F', description: '10-character PAN' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, { message: 'Invalid PAN format.' })
  panNumber!: string;

  @ApiProperty({ description: 'Full name as entered by the user (matched against vendor response).' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ description: 'Date of birth as YYYY-MM-DD (stored on lead detail for this step).' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dob!: string;
}
