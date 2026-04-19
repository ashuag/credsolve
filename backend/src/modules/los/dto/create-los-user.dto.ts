import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateLosUserDto {
  @ApiProperty({ example: 'Rahul Sharma' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: 'rahul@example.com' })
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  roleId!: number;

  @ApiPropertyOptional({ description: 'Required when role hierarchy level is greater than 1' })
  @IsOptional()
  @IsString()
  managerId?: string | null;
}
