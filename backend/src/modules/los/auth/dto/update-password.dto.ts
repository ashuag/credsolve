import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty({ example: 'Secret123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  currentPassword!: string;

  @ApiProperty({ example: 'NewSecret123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;
}
