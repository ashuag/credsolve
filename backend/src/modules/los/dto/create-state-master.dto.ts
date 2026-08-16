import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateStateMasterDto {
  @ApiProperty({ example: 'Maharashtra', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'MH', maxLength: 5 })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5)
  code!: string;
}
