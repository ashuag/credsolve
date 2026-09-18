import type { LosApplicationDetails } from '@/lib/api';
import { buildApplicationWorkspaceAlertText, isApplicationRecordRejected, applicationRejectionHeadline } from '@/lib/application-workspace-status';
import { parseInrNumber } from '@/lib/application-review-format';
import { comparePan } from '@/lib/kyc-field-match';
import { BANK_DETAIL_FAILED_LABEL, isBankDetailFailed } from '@/lib/penny-drop-grant-retry-eligibility';

export type ReviewFlag = {
  icon: string;
  title: string;
  detail: string;
};

export function hasAadhaarKycMismatch(row: LosApplicationDetails): boolean {
  const mismatch = row.aadhaarKycMismatch;
  if (mismatch && (mismatch.name || mismatch.dob || mismatch.gender)) return true;
  if (row.aadhaarNameMatchPendingReview) return true;
  if (row.aadhaarIdentityFailure) return true;
  return false;
}

export function buildReviewFlags(row: LosApplicationDetails, bureauPan?: string | null): ReviewFlag[] {
  const flags: ReviewFlag[] = [];

  if (isApplicationRecordRejected(row)) {
    flags.push({
      icon: '✕',
      title: applicationRejectionHeadline(row),
      detail: buildApplicationWorkspaceAlertText(row) ?? 'This application has been rejected and cannot proceed.',
    });
  } else if (row.nameMatchPendingReview || row.statusCode.toUpperCase() === 'UNDER_REVIEW') {
    const score = row.bankAccountAttempts?.[0]?.nameMatchScore;
    flags.push({
      icon: '◎',
      title: 'Bank name match under review',
      detail:
        score != null
          ? `Customer name vs bank account name scored ${score}%. Credit must approve before the customer can continue.`
          : 'Customer name does not match the penny-drop bank account name. Credit must approve before the customer can continue.',
    });
  } else if (isBankDetailFailed(row)) {
    flags.push({
      icon: '✕',
      title: BANK_DETAIL_FAILED_LABEL,
      detail: 'Penny-drop verification failed and the customer has no attempts remaining.',
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

  const mismatch = row.aadhaarKycMismatch;
  const mismatchMessages = mismatch?.messages ?? [];
  if (mismatch?.name) {
    flags.push({
      icon: row.aadhaarNameMatchPendingReview ? '✕' : '◎',
      title: row.aadhaarNameMatchPendingReview ? 'Aadhaar name mismatch — credit review' : 'Aadhaar name mismatch',
      detail:
        mismatchMessages.find((message) => /name/i.test(message)) ??
        'Profile name does not match the DigiLocker Aadhaar record.',
    });
  }
  if (mismatch?.dob) {
    flags.push({
      icon: '✕',
      title: 'Aadhaar DOB mismatch',
      detail:
        mismatchMessages.find((message) => /date of birth|dob/i.test(message)) ??
        'Date of birth on profile does not match Aadhaar.',
    });
  }
  if (mismatch?.gender) {
    flags.push({
      icon: '✕',
      title: 'Aadhaar gender mismatch',
      detail:
        mismatchMessages.find((message) => /gender/i.test(message)) ??
        'Gender on profile does not match Aadhaar.',
    });
  }
  if (!mismatch && row.aadhaarIdentityFailure?.message) {
    flags.push({
      icon: '✕',
      title: 'Aadhaar KYC mismatch',
      detail: row.aadhaarIdentityFailure.message,
    });
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
