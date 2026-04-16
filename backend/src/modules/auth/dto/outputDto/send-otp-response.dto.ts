import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendOtpResponseDto {
  @ApiProperty({ example: '9c8161a4-6df0-4e39-a6a4-2fa9f2f2fd22' })
  requestId!: string;

  @ApiProperty({ example: '88*** ***39' })
  maskedValue!: string;

  @ApiProperty({ example: 30 })
  resendAfterSeconds!: number;

  @ApiProperty({ example: '2026-04-04T10:41:55.593Z' })
  resendAvailableAt!: string;

  @ApiProperty({ example: '2026-04-04T10:43:25.593Z' })
  expiresAt!: string;

  @ApiPropertyOptional({ example: '649756' })
  debugOtp?: string;
}
