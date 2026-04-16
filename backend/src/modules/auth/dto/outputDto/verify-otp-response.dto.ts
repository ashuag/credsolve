import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class VerifiedCustomerDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '9c8161a4-6df0-4e39-a6a4-2fa9f2f2fd22' })
  uuid!: string;

  @ApiProperty({ example: '9876543210' })
  mobileNumber!: string;

  @ApiProperty({ example: '2026-04-05T06:41:55.593Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: 'b3f1e2d4-8c9a-4b7e-a1f0-3d2c5e6f7a8b' })
  leadUuid?: string;

  @ApiPropertyOptional({ example: 'user@gmail.com', nullable: true })
  leadEmail?: string | null;

  @ApiPropertyOptional({ example: 'EMAIL_VERIFIED' })
  leadStatus?: string;
}

export class VerifyOtpResponseDto {
  @ApiPropertyOptional({ example: true })
  success?: boolean;

  @ApiPropertyOptional({ example: '9c8161a4-6df0-4e39-a6a4-2fa9f2f2fd22' })
  requestId?: string;

  @ApiPropertyOptional({ example: true })
  verified?: boolean;

  @ApiPropertyOptional({ example: '2026-04-05T06:41:55.593Z' })
  verifiedAt?: string;

  @ApiPropertyOptional({ example: 'b3f1e2d4-8c9a-4b7e-a1f0-3d2c5e6f7a8b' })
  leadId?: string;

  @ApiPropertyOptional({ example: 'EMAIL_VERIFIED' })
  leadStatus?: string;

  @ApiPropertyOptional({ example: '9c8161a4-6df0-4e39-a6a4-2fa9f2f2fd22' })
  customerId?: string;

  @ApiPropertyOptional({ example: '8882911939' })
  mobileNumber?: string;

  @ApiPropertyOptional({ type: VerifiedCustomerDto })
  customer?: VerifiedCustomerDto;
}
