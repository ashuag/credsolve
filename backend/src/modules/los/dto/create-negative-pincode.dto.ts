import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateNegativePincodeDto {
  @ApiProperty({ example: '110001' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pincode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
