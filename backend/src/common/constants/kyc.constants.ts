/** Max failed DigiLocker Aadhaar download attempts before the lead is rejected. */
export const DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS = 3;

/**
 * Max KYC liveness / face-match attempts before the lead is escalated to
 * INTERNAL_ERROR (thank-you page). The customer may retake the selfie and rerun
 * the pipeline up to this many times.
 */
export const KYC_LIVENESS_MAX_ATTEMPTS = 3;

/** Written to `lead.lead_status_note` when KYC vendor auth/config fails (e.g. invalid Tenacio API key). */
export const KYC_VENDOR_TECHNICAL_ISSUE_LEAD_NOTE = 'Due to technical issue unable to process';

/** Customer-facing copy when KYC is escalated for a vendor technical issue (matches INTERNAL_ERROR SMS template). */
export const KYC_VENDOR_TECHNICAL_ISSUE_CUSTOMER_MESSAGE =
  'Thank you for your request. One of our representatives will contact you shortly for additional information. We appreciate your patience.';
