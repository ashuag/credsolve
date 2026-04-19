import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateLosRoleDto {
  @ApiProperty({ example: 'Underwriter' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  hierarchyLevel!: number;
}
