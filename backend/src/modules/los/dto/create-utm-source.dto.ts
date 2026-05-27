import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUtmSourceDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  leadSourceId!: number;

  @ApiProperty({ example: 'google' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
