import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateNamedMasterDto {
  @ApiProperty({ example: 'Self Employed' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}
