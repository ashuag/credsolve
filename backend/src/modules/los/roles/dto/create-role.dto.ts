import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Branch Manager' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 2, description: 'Hierarchy level where 1 is the top-most ADMIN role' })
  @IsInt()
  @Min(1)
  hierarchyLevel!: number;
}
