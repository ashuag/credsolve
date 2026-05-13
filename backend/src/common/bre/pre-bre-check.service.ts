import { Injectable, Logger } from '@nestjs/common';
import { REJECTION_REASON } from '../constants/rejection-reason.constants';
import type { BreSettings } from '../../modules/auth/infrastructure/repositories/settings.repository';
import { PrismaService } from '../../prisma/prisma.service';

export interface PreBreCheckInput {
  dateOfBirth: Date | null;
  genderId: number | null;
  occupationId: number | null;
  /** Human-readable (e.g. DB `gender.name`) for `lead_status_note`. */
  genderDisplay?: string | null;
  /** Human-readable (e.g. DB `occupation.name`) for `lead_status_note`. */
  occupationDisplay?: string | null;
  pincode: string | null;
  cityId: number | null;
  stateId: number | null;
  cityName: string | null;
  stateCode: string | null;
}

export interface PreBreCheckResult {
  passed: boolean;
  rejectReason: string | null;
  rejectionReasonCode: string | null;
}

@Injectable()
export class PreBreCheckService {
  private readonly logger = new Logger(PreBreCheckService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(input: PreBreCheckInput, settings: BreSettings): Promise<PreBreCheckResult> {
    const ageResult = this.checkAge(input, settings.minAge, settings.maxAge);
    if (!ageResult.passed) return ageResult;

    const genderResult = this.checkRejectedGender(input, settings.rejectedGenderIds);
    if (!genderResult.passed) return genderResult;

    const occupationResult = this.checkRejectedOccupation(input, settings.rejectedOccupationIds);
    if (!occupationResult.passed) return occupationResult;

    const pincodeNorm = input.pincode?.trim() ?? '';
    const pincodeOk = pincodeNorm.length === 6 && /^\d{6}$/.test(pincodeNorm);

    const [blockedPincode, blockedCity, blockedState] = await Promise.all([
      pincodeOk
        ? this.prisma.client.negativePincode.findFirst({
            where: { pincode: pincodeNorm, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.cityId != null
        ? this.prisma.client.negativeCity.findFirst({
            where: { cityId: input.cityId, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.stateId != null
        ? this.prisma.client.negativeState.findFirst({
            where: { stateId: input.stateId, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (blockedPincode) {
      this.logger.warn(`Pre-BRE negative pincode (table): ${pincodeNorm}`);
      return {
        passed: false,
        rejectReason: this.withLeadContext(
          input,
          `Negative pincode list: pincode=${pincodeNorm} blocked`,
        ),
        rejectionReasonCode: REJECTION_REASON.NEGATIVE_PINCODE,
      };
    }

    if (blockedCity) {
      const label = input.cityName?.trim() || String(input.cityId);
      this.logger.warn(`Pre-BRE negative city (table): cityId=${input.cityId}`);
      return {
        passed: false,
        rejectReason: this.withLeadContext(
          input,
          `Negative city list: cityId=${input.cityId} name=${label}`,
        ),
        rejectionReasonCode: REJECTION_REASON.NEGATIVE_CITY,
      };
    }

    if (blockedState) {
      const label = input.stateCode?.trim() || String(input.stateId);
      this.logger.warn(`Pre-BRE negative state (table): stateId=${input.stateId}`);
      return {
        passed: false,
        rejectReason: this.withLeadContext(
          input,
          `Negative state list: stateId=${input.stateId} code=${label}`,
        ),
        rejectionReasonCode: REJECTION_REASON.NEGATIVE_STATE,
      };
    }

    return { passed: true, rejectReason: null, rejectionReasonCode: null };
  }

  private checkRejectedGender(input: PreBreCheckInput, rejectedIds: number[]): PreBreCheckResult {
    const { genderId } = input;
    if (rejectedIds.length === 0) {
      return { passed: true, rejectReason: null, rejectionReasonCode: null };
    }
    if (genderId == null) {
      return {
        passed: false,
        rejectReason: this.withLeadContext(input, 'Gender missing on lead_detail (required for policy check)'),
        rejectionReasonCode: REJECTION_REASON.GENDER_BRE_FAILED,
      };
    }
    if (rejectedIds.includes(genderId)) {
      this.logger.warn(`Pre-BRE rejected gender: genderId=${genderId}`);
      const g = input.genderDisplay?.trim() || `id=${genderId}`;
      return {
        passed: false,
        rejectReason: this.withLeadContext(
          input,
          `Gender policy: blocked genderId=${genderId} (${g}); blockedIds=[${rejectedIds.join(',')}]`,
          'occ-only',
        ),
        rejectionReasonCode: REJECTION_REASON.GENDER_BRE_FAILED,
      };
    }
    return { passed: true, rejectReason: null, rejectionReasonCode: null };
  }

  private checkRejectedOccupation(input: PreBreCheckInput, rejectedIds: number[]): PreBreCheckResult {
    const { occupationId } = input;
    if (rejectedIds.length === 0) {
      return { passed: true, rejectReason: null, rejectionReasonCode: null };
    }
    if (occupationId == null) {
      return {
        passed: false,
        rejectReason: this.withLeadContext(input, 'Occupation missing on lead_detail (required for policy check)'),
        rejectionReasonCode: REJECTION_REASON.OCCUPATION_FAILED,
      };
    }
    if (rejectedIds.includes(occupationId)) {
      this.logger.warn(`Pre-BRE rejected occupation: occupationId=${occupationId}`);
      const o = input.occupationDisplay?.trim() || `id=${occupationId}`;
      return {
        passed: false,
        rejectReason: this.withLeadContext(
          input,
          `Occupation policy: blocked occupationId=${occupationId} (${o}); blockedIds=[${rejectedIds.join(',')}]`,
          'gender-only',
        ),
        rejectionReasonCode: REJECTION_REASON.OCCUPATION_FAILED,
      };
    }
    return { passed: true, rejectReason: null, rejectionReasonCode: null };
  }

  private checkAge(input: PreBreCheckInput, minAge: number, maxAge: number): PreBreCheckResult {
    const dob = input.dateOfBirth;
    if (!dob) {
      return {
        passed: false,
        rejectReason: this.withLeadContext(input, 'DOB missing (cannot verify age band)'),
        rejectionReasonCode: REJECTION_REASON.MIN_AGE_BRE_FAILED,
      };
    }

    const today = new Date();
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) {
      age--;
    }

    const dobIso = dob.toISOString().slice(0, 10);

    if (age < minAge) {
      this.logger.warn(`Pre-BRE min-age check failed: age=${age}, min=${minAge}`);
      return {
        passed: false,
        rejectReason: this.withLeadContext(
          input,
          `Min-age rule: currentAge=${age}y, allowed=${minAge}-${maxAge}y, DOB=${dobIso}`,
        ),
        rejectionReasonCode: REJECTION_REASON.MIN_AGE_BRE_FAILED,
      };
    }
    if (age > maxAge) {
      this.logger.warn(`Pre-BRE max-age check failed: age=${age}, max=${maxAge}`);
      return {
        passed: false,
        rejectReason: this.withLeadContext(
          input,
          `Max-age rule: currentAge=${age}y, allowed=${minAge}-${maxAge}y, DOB=${dobIso}`,
        ),
        rejectionReasonCode: REJECTION_REASON.MAX_AGE_BRE_FAILED,
      };
    }
    return { passed: true, rejectReason: null, rejectionReasonCode: null };
  }

  /** Appends compact occupation/gender context for LOS `lead_status_note` (VARCHAR 256). */
  private withLeadContext(
    input: PreBreCheckInput,
    main: string,
    tail: 'both' | 'occ-only' | 'gender-only' = 'both',
  ): string {
    const parts = [main.trim()];
    const occ = input.occupationDisplay?.trim();
    const gen = input.genderDisplay?.trim();
    if ((tail === 'both' || tail === 'occ-only') && occ) parts.push(`occ=${occ}`);
    if ((tail === 'both' || tail === 'gender-only') && gen) parts.push(`gender=${gen}`);
    return parts.join(' | ').slice(0, 256);
  }
}
