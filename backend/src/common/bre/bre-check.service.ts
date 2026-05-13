import { Injectable, Logger } from '@nestjs/common';
import { REJECTION_REASON } from '../constants/rejection-reason.constants';
import type { BreSettings } from '../../modules/auth/infrastructure/repositories/settings.repository';

export interface BreInput {
  dateOfBirth: Date | null;
  pincode: string | null;
  cityName: string | null;
  stateCode: string | null;
}

export interface BreResult {
  passed: boolean;
  rejectReason: string | null;
  rejectionReasonCode: string | null;
}

@Injectable()
export class BreCheckService {
  private readonly logger = new Logger(BreCheckService.name);

  run(input: BreInput, settings: BreSettings): BreResult {
    const ageResult = this.checkAge(input.dateOfBirth, settings.minAge, settings.maxAge);
    if (!ageResult.passed) return ageResult;

    const pincodeResult = this.checkNegativePincode(input.pincode, settings.negativePincodes);
    if (!pincodeResult.passed) return pincodeResult;

    const cityResult = this.checkNegativeCity(input.cityName, settings.negativeCities);
    if (!cityResult.passed) return cityResult;

    const stateResult = this.checkNegativeState(input.stateCode, settings.negativeStates);
    if (!stateResult.passed) return stateResult;

    return { passed: true, rejectReason: null, rejectionReasonCode: null };
  }

  private checkAge(dob: Date | null, minAge: number, maxAge: number): BreResult {
    if (!dob) {
      return { passed: false, rejectReason: 'Date of birth is required', rejectionReasonCode: REJECTION_REASON.MIN_AGE_BRE_FAILED };
    }

    const today = new Date();
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) {
      age--;
    }

    if (age < minAge) {
      this.logger.warn(`BRE min-age check failed: age=${age}, min=${minAge}`);
      return { passed: false, rejectReason: `Age limit exceeded (must be ${minAge}–${maxAge} years)`, rejectionReasonCode: REJECTION_REASON.MIN_AGE_BRE_FAILED };
    }
    if (age > maxAge) {
      this.logger.warn(`BRE max-age check failed: age=${age}, max=${maxAge}`);
      return { passed: false, rejectReason: `Age limit exceeded (must be ${minAge}–${maxAge} years)`, rejectionReasonCode: REJECTION_REASON.MAX_AGE_BRE_FAILED };
    }
    return { passed: true, rejectReason: null, rejectionReasonCode: null };
  }

  private checkNegativePincode(pincode: string | null, negativePincodes: string[]): BreResult {
    if (!pincode || negativePincodes.length === 0) {
      return { passed: true, rejectReason: null, rejectionReasonCode: null };
    }
    if (negativePincodes.includes(pincode.trim().toLowerCase())) {
      this.logger.warn(`BRE negative pincode: ${pincode}`);
      return { passed: false, rejectReason: `Pincode ${pincode} is not serviceable`, rejectionReasonCode: REJECTION_REASON.NEGATIVE_PINCODE };
    }
    return { passed: true, rejectReason: null, rejectionReasonCode: null };
  }

  private checkNegativeCity(cityName: string | null, negativeCities: string[]): BreResult {
    if (!cityName || negativeCities.length === 0) {
      return { passed: true, rejectReason: null, rejectionReasonCode: null };
    }
    if (negativeCities.includes(cityName.trim().toLowerCase())) {
      this.logger.warn(`BRE negative city: ${cityName}`);
      return { passed: false, rejectReason: `City ${cityName} is not serviceable`, rejectionReasonCode: REJECTION_REASON.NEGATIVE_CITY };
    }
    return { passed: true, rejectReason: null, rejectionReasonCode: null };
  }

  private checkNegativeState(stateCode: string | null, negativeStates: string[]): BreResult {
    if (!stateCode || negativeStates.length === 0) {
      return { passed: true, rejectReason: null, rejectionReasonCode: null };
    }
    if (negativeStates.includes(stateCode.trim().toLowerCase())) {
      this.logger.warn(`BRE negative state: ${stateCode}`);
      return { passed: false, rejectReason: `State ${stateCode} is not serviceable`, rejectionReasonCode: REJECTION_REASON.NEGATIVE_STATE };
    }
    return { passed: true, rejectReason: null, rejectionReasonCode: null };
  }
}
