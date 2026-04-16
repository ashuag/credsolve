import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Senior Branch Manager' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 3, description: 'Hierarchy level where 1 is reserved for ADMIN' })
  @IsOptional()
  @IsInt()
  @Min(1)
  hierarchyLevel?: number;
}
