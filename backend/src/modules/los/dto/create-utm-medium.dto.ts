import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUtmMediumDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  leadSourceId!: number;

  @ApiProperty({ example: 'cpc' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
