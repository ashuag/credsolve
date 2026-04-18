import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * JSON body for successful `POST /auth/verify-otp`.
 * The opaque session id is **not** included here; it is sent only as `Set-Cookie` (HttpOnly).
 */
export class VerifyOtpSuccessResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ format: 'uuid', description: 'OTP request id that was verified' })
  requestId!: string;

  @ApiProperty({ example: true })
  verified!: boolean;

  @ApiProperty({ example: '2026-04-18T12:00:00.000Z' })
  verifiedAt!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Present for mobile OTP' })
  customerId?: string;

  @ApiPropertyOptional({ example: '9555555553', description: 'Present for mobile OTP' })
  mobileNumber?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Active lead uuid; present for mobile OTP' })
  leadId?: string | null;

  @ApiPropertyOptional({ example: 'NEW', description: 'Lead status name; present for mobile OTP' })
  leadStatus?: string | null;
}
