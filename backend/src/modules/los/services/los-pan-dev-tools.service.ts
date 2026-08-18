import { Injectable } from '@nestjs/common';
import { PAN_VERIFIED } from '../../../common/constants/pan-verification.constants';
import { PanVerificationService } from '../../../common/vendor/pan-verification.service';
import type { NsdlPanVerificationDto } from '../dto/nsdl-pan-verification.dto';

export type NsdlPanVerificationDryRunResult = {
  vendor: 'Tenacio NSDL';
  configured: boolean;
  skipReason: string | null;
  structureValid: boolean;
  structureNote: string | null;
  panVerifiedStatus: number;
  panVerifiedLabel: string;
  nameMatch: boolean;
  dobMatch: boolean;
  panStatus: string | null;
  category: string | null;
  vendorRequestId: string | null;
  note: string | null;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
};

function panVerifiedStatusLabel(code: number): string {
  switch (code) {
    case PAN_VERIFIED.NOT_CHECKED:
      return 'Not checked';
    case PAN_VERIFIED.VERIFIED:
      return 'Verified';
    case PAN_VERIFIED.NOT_VERIFIED:
      return 'Not verified';
    case PAN_VERIFIED.API_FAILURE:
      return 'API failure';
    case PAN_VERIFIED.API_DISABLED:
      return 'Disabled';
    default:
      return `Unknown (${code})`;
  }
}

/**
 * LOS developer tools: live Tenacio NSDL PAN name/DOB verification.
 * Calls are audited via `vendor_api_log` (leadId is null — not tied to a lead).
 */
@Injectable()
export class LosPanDevToolsService {
  constructor(private readonly panVerification: PanVerificationService) {}

  async runNsdlPanVerification(dto: NsdlPanVerificationDto): Promise<NsdlPanVerificationDryRunResult> {
    const panNumber = dto.panNumber.trim().toUpperCase();
    const fullName = dto.fullName.trim();
    const dobIso = dto.dateOfBirth.trim();
    const structure = this.panVerification.validatePanStructure(panNumber, fullName);
    const vendor = await this.panVerification.verifyWithVendor({
      leadId: null,
      panNumber,
      fullName,
      dobIso,
      consent: dto.consent ?? true,
    });

    return {
      vendor: 'Tenacio NSDL',
      configured: vendor.configured,
      skipReason: vendor.skipReason,
      structureValid: structure.valid,
      structureNote: structure.note || null,
      panVerifiedStatus: vendor.panVerifiedStatus,
      panVerifiedLabel: panVerifiedStatusLabel(vendor.panVerifiedStatus),
      nameMatch: vendor.nameMatch,
      dobMatch: vendor.dobMatch,
      panStatus: vendor.panStatus,
      category: vendor.category,
      vendorRequestId: vendor.vendorRequestId,
      note: vendor.note,
      ok: vendor.panVerifiedStatus === PAN_VERIFIED.VERIFIED,
      httpStatus: vendor.httpStatus,
      vendorBody: vendor.vendorBody,
    };
  }
}
