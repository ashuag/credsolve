import { Injectable } from '@nestjs/common';

export type PanVerificationStatus =
  | 'verified'
  | 'not_found'
  | 'name_mismatch'
  | 'bureau_error'
  | 'blacklisted';

export type PanVerificationResult = {
  status: PanVerificationStatus;
};

/**
 * Mock PAN verification service.
 * Distribution: 70% verified, 10% not_found, 8% name_mismatch, 7% bureau_error, 5% blacklisted.
 * Replace with real NSDL/bureau integration later.
 */
@Injectable()
export class PanVerificationService {
  async verify(_panNumber: string, _fullName?: string): Promise<PanVerificationResult> {
    const rand = Math.random();

    if (rand < 0.70) return { status: 'verified' };
    if (rand < 0.80) return { status: 'not_found' };
    if (rand < 0.88) return { status: 'name_mismatch' };
    if (rand < 0.95) return { status: 'bureau_error' };
    return { status: 'blacklisted' };
  }
}
