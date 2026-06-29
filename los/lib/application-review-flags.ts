import type { LosApplicationDetails } from '@/lib/api';
import { buildApplicationWorkspaceAlertText, isApplicationRecordRejected, applicationRejectionHeadline } from '@/lib/application-workspace-status';
import { parseInrNumber } from '@/lib/application-review-format';
import {
  compareGenders,
  compareIsoDates,
  comparePan,
  computeNameMatchScore,
  extractCibilPan,
  nameMatchVerdict,
} from '@/lib/kyc-field-match';

export type ReviewFlag = {
  icon: string;
  title: string;
  detail: string;
};

export function buildReviewFlags(row: LosApplicationDetails, bureauPan?: string | null): ReviewFlag[] {
  const flags: ReviewFlag[] = [];

  if (isApplicationRecordRejected(row)) {
    flags.push({
      icon: '✕',
      title: applicationRejectionHeadline(row),
      detail: buildApplicationWorkspaceAlertText(row) ?? 'This application has been rejected and cannot proceed.',
    });
  }

  const profile = row.lead.profile;
  const details = row.details;
  const bank = row.disbursement;

  const processingFee = parseInrNumber(details?.processingFeeAmount ?? null);
  const gst = parseInrNumber(details?.gstAmount ?? null);
  if (processingFee != null && processingFee > 0 && gst != null && gst > 0) {
    flags.push({
      icon: '↻',
      title: 'Fees in disbursement and repayment',
      detail: 'Processing fee and GST are deducted upfront and included in the repayable total. Confirm this matches the KFS disclosure.',
    });
  }

  if (bank?.accountNumber?.trim() && !bank.disbursedAt) {
    flags.push({
      icon: '⌖',
      title: 'UTR not generated',
      detail: 'Disbursement still pending — payout has not been initiated.',
    });
  }

  const aadhaar = row.aadhaarDetail;
  if (profile && aadhaar?.fullName) {
    const nameScore = computeNameMatchScore(profile.fullName, aadhaar.fullName);
    if (nameMatchVerdict(nameScore, true) === 'mismatch') {
      flags.push({
        icon: '◎',
        title: 'Aadhaar name mismatch',
        detail: 'Profile name does not match the DigiLocker Aadhaar record.',
      });
    }
    if (compareIsoDates(profile.dateOfBirth, aadhaar.dateOfBirth) === 'mismatch') {
      flags.push({
        icon: '◎',
        title: 'Aadhaar DOB mismatch',
        detail: 'Date of birth on profile does not match Aadhaar.',
      });
    }
    if (compareGenders(profile.gender, aadhaar.gender) === 'mismatch') {
      flags.push({
        icon: '◎',
        title: 'Aadhaar gender mismatch',
        detail: 'Gender on profile does not match Aadhaar.',
      });
    }
  }

  const profilePan = profile?.panNumber?.trim() || row.lead.panNumber?.trim();
  if (profilePan && bureauPan && comparePan(profilePan, bureauPan) === 'mismatch') {
    flags.push({
      icon: '◎',
      title: 'PAN bureau mismatch',
      detail: 'Application PAN does not match the CIBIL bureau record.',
    });
  }

  if (!row.lead.sourceName) {
    flags.push({
      icon: '◌',
      title: 'Unattributed lead source',
      detail: 'No acquisition source or UTM campaign is linked to this application.',
    });
  }

  return flags;
}
