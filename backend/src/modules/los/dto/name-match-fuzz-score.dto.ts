import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Request body for the LOS developer name-match fuzzing score tool. */
export class NameMatchFuzzScoreDto {
  @ApiProperty({ example: 'Saurabh Agarwal', description: 'Customer / journey full name' })
  @IsString()
  @Length(1, 160)
  customerName!: string;

  @ApiProperty({
    example: 'Mr SAURABH KUMAR AGARWAL',
    description: 'Bank account holder name as returned by penny-drop',
  })
  @IsString()
  @Length(1, 160)
  bankAccountName!: string;
}
