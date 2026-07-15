import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export class CreateContactSubmissionDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ maxLength: 190 })
  @IsEmail()
  @MaxLength(190)
  email!: string;

  @ApiProperty({ example: '9876543210', description: '10-digit Indian mobile starting with 6–9.' })
  @IsString()
  @IsNotEmpty()
  @Matches(INDIAN_MOBILE, { message: 'phone must be a 10-digit Indian mobile starting with 6–9.' })
  phone!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ minLength: 5, maxLength: 5000 })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(5000)
  message!: string;
}
