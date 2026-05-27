import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length, Matches } from 'class-validator';

export class AcceptLoanDocumentsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  requestId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  @Matches(/^\d+$/, { message: 'otpCode must contain digits only.' })
  otpCode!: string;
}
