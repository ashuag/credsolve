import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';

@Injectable()
export class OtpCodeGenerator {
  /** Numeric OTP; length capped at 6 to fit `otp_request.otp_code` (VarChar(6)). */
  generate(length: number): string {
    const safeLen = Math.min(Math.max(length, 4), 6);
    const min = 10 ** (safeLen - 1);
    const maxExclusive = 10 ** safeLen;
    return String(randomInt(min, maxExclusive));
  }
}
