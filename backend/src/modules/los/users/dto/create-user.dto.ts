import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsString, Matches, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Rahul Sharma' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: 'rahul@moneycash.test' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 1, description: 'ID of the UserRole record' })
  @IsInt()
  @Min(1)
  roleId!: number;

  @ApiPropertyOptional({ example: '1', description: 'User ID of the reporting manager, if applicable' })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(/^\d+$/)
  managerId?: string | null;
}
