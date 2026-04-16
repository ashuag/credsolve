import { Injectable } from '@nestjs/common';
import { GetOtpTypesResponseDto } from '../dto/outputDto/get-otp-types-response.dto';
import { OtpTypeCacheService } from '../services/otp-type-cache.service';

@Injectable()
export class GetOtpTypesUseCase {
  constructor(private readonly otpTypeCacheService: OtpTypeCacheService) {}

  async execute(): Promise<GetOtpTypesResponseDto> {
    return {
      values: await this.otpTypeCacheService.getOtpTypes()
    };
  }
}
