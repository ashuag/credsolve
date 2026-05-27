import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUtmCampaignDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  leadSourceId!: number;

  @ApiProperty({ example: 'summer-sale' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
