// PAN verification is handled by the backend (POST /applications/details).
// This file only exports the shared type used by both the API layer and UI.

export type PanVerificationStatus =
  | 'verified'
  | 'not_found'
  | 'name_mismatch'
  | 'bureau_error'
  | 'blacklisted';

export type PanVerificationResult = {
  status: PanVerificationStatus;
};
