import type { PrismaClient } from '@prisma/client';

/**
 * Columns for DigiLocker / selfie / liveness flows, loaded via SQL so reads stay
 * compatible even if `npm run prisma:generate` was not run after new
 * `application` columns were added (stale `@prisma/client` would reject
 * `select: { digilockerAadhaarFormJson: true }`).
 *
 * Writes still require an up-to-date client — run `npm run prisma:generate`
 * after pulling schema changes.
 */
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
  loanDocumentsAcceptedAt: Date | null;
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
            a.email_id AS email,
            a.email_verification_type AS emailVerificationType,
            a.kyc_status AS kycStatus,
            a.digilocker_aadhaar_form_json AS digilockerAadhaarFormJson,
            a.aadhaar_photo_relative_path AS aadhaarPhotoRelativePath,
            a.selfie_relative_path AS selfieRelativePath,
            a.liveness_passed AS livenessPassed,
            a.loan_documents_accepted_at AS loanDocumentsAcceptedAt
          FROM application a
          WHERE a.lead_id = ${leadId} AND a.customer_id = ${customerId}
          ORDER BY a.created_at DESC
          LIMIT 1
        `
      : await client.$queryRaw<ApplicationKycSnapshotRow[]>`
          SELECT
            a.id AS id,
            a.uuid AS uuid,
            a.email_id AS email,
            a.email_verification_type AS emailVerificationType,
            a.kyc_status AS kycStatus,
            a.digilocker_aadhaar_form_json AS digilockerAadhaarFormJson,
            a.aadhaar_photo_relative_path AS aadhaarPhotoRelativePath,
            a.selfie_relative_path AS selfieRelativePath,
            a.liveness_passed AS livenessPassed,
            a.loan_documents_accepted_at AS loanDocumentsAcceptedAt
          FROM application a
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
    livenessPassed: Boolean(row.livenessPassed),
  };
}
