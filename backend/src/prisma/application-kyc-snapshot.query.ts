import type { PrismaClient } from '@prisma/client';

export type ApplicationKycSnapshotRow = {
  id: bigint;
  uuid: string;
  email: string | null;
  emailVerificationType: string | null;
  kycStatus: number;
  digilockerAadhaarFormJson: unknown;
  aadhaarPhotoRelativePath: string | null;
  selfieRelativePath: string | null;
  livenessPassed: boolean;
  /** `application_kyc.is_liveness` — pipeline finished (pass or fail). */
  livenessCheckCompleted: boolean;
  /** `application_kyc.liveness_attempts` — failed pipeline runs so far. */
  livenessAttempts: number;
  loanDocumentsAcceptedAt: Date | null;
  loanDocumentsReviewedAt: Date | null;
};

export async function fetchLatestApplicationKycSnapshot(
  client: PrismaClient,
  params: { leadId: bigint; customerId?: bigint },
): Promise<ApplicationKycSnapshotRow | null> {
  const { leadId, customerId } = params;

  const rows =
    customerId !== undefined
      ? await client.$queryRaw<ApplicationKycSnapshotRow[]>`
          SELECT
            a.id AS id,
            a.uuid AS uuid,
            ad.email_id AS email,
            ad.email_verification_type AS emailVerificationType,
            COALESCE(ak.kyc_status, 0) AS kycStatus,
            ck.aadhaar_data AS digilockerAadhaarFormJson,
            ck.aadhaar_photo_path AS aadhaarPhotoRelativePath,
            ak.liveness_selfie_path AS selfieRelativePath,
            COALESCE(ak.liveness_passed, false) AS livenessPassed,
            COALESCE(ak.is_liveness, false) AS livenessCheckCompleted,
            COALESCE(ak.liveness_attempts, 0) AS livenessAttempts,
            ad.loan_documents_accepted_at AS loanDocumentsAcceptedAt,
            ad.loan_documents_reviewed_at AS loanDocumentsReviewedAt
          FROM application a
          LEFT JOIN application_detail ad ON ad.application_id = a.id
          LEFT JOIN application_kyc ak ON ak.application_id = a.id
          LEFT JOIN customer_kyc ck ON ck.customer_id = a.customer_id
          WHERE a.lead_id = ${leadId} AND a.customer_id = ${customerId}
          ORDER BY a.created_at DESC
          LIMIT 1
        `
      : await client.$queryRaw<ApplicationKycSnapshotRow[]>`
          SELECT
            a.id AS id,
            a.uuid AS uuid,
            ad.email_id AS email,
            ad.email_verification_type AS emailVerificationType,
            COALESCE(ak.kyc_status, 0) AS kycStatus,
            ck.aadhaar_data AS digilockerAadhaarFormJson,
            ck.aadhaar_photo_path AS aadhaarPhotoRelativePath,
            ak.liveness_selfie_path AS selfieRelativePath,
            COALESCE(ak.liveness_passed, false) AS livenessPassed,
            COALESCE(ak.is_liveness, false) AS livenessCheckCompleted,
            COALESCE(ak.liveness_attempts, 0) AS livenessAttempts,
            ad.loan_documents_accepted_at AS loanDocumentsAcceptedAt,
            ad.loan_documents_reviewed_at AS loanDocumentsReviewedAt
          FROM application a
          LEFT JOIN application_detail ad ON ad.application_id = a.id
          LEFT JOIN application_kyc ak ON ak.application_id = a.id
          LEFT JOIN customer_kyc ck ON ck.customer_id = a.customer_id
          WHERE a.lead_id = ${leadId}
          ORDER BY a.created_at DESC
          LIMIT 1
        `;

  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    ...row,
    kycStatus: Number(row.kycStatus),
    livenessPassed: Boolean(row.livenessPassed),
    livenessCheckCompleted: Boolean(row.livenessCheckCompleted),
    livenessAttempts: Number(row.livenessAttempts ?? 0),
  };
}
