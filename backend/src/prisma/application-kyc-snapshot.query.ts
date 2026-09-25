import type { PrismaClient } from '@prisma/client';
import { APPLICATION_KYC_STATUS } from '../common/constants/application.constants';
import { SettingKey } from '../common/constants/setting.constants';
import { kycValidityCutoff, parseKycValidityDays } from '../common/kyc/customer-aadhaar-for-application.util';

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
  /** `application_kyc.liveness_vendor_json` — carries the `activeLiveness` head-movement block. */
  livenessVendorJson: unknown;
  /** `application_kyc.is_liveness` — pipeline finished (pass or fail). */
  livenessCheckCompleted: boolean;
  /** `application_kyc.liveness_attempts` — failed pipeline runs so far. */
  livenessAttempts: number;
  loanDocumentsAcceptedAt: Date | null;
  loanDocumentsReviewedAt: Date | null;
};

const KYC_FAILED = APPLICATION_KYC_STATUS.FAILED;

async function readKycValidityCutoff(client: PrismaClient): Promise<Date> {
  const row = await client.setting.findFirst({
    where: { key: SettingKey.KYC_VALIDITY_DAYS.key, isActive: true },
    select: { value: true },
  });
  return kycValidityCutoff(new Date(), parseKycValidityDays(row?.value));
}

export async function fetchLatestApplicationKycSnapshot(
  client: PrismaClient,
  params: { leadId: bigint; customerId?: bigint },
): Promise<ApplicationKycSnapshotRow | null> {
  const { leadId, customerId } = params;
  const reuseCutoff = await readKycValidityCutoff(client);

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
            ak.liveness_vendor_json AS livenessVendorJson,
            COALESCE(ak.is_liveness, false) AS livenessCheckCompleted,
            COALESCE(ak.liveness_attempts, 0) AS livenessAttempts,
            ad.loan_documents_accepted_at AS loanDocumentsAcceptedAt,
            ad.loan_documents_reviewed_at AS loanDocumentsReviewedAt
          FROM application a
          LEFT JOIN application_detail ad ON ad.application_id = a.id
          LEFT JOIN application_kyc ak ON ak.application_id = a.id
          LEFT JOIN customer_kyc ck ON ck.id = (
            SELECT ck2.id
            FROM customer_kyc ck2
            WHERE ck2.customer_id = a.customer_id
              AND (
                (ck2.aadhaar_verified_at IS NOT NULL AND ck2.aadhaar_verified_at >= a.created_at)
                OR (
                  ck2.aadhaar_verified_at IS NOT NULL
                  AND ck2.aadhaar_verified_at >= ${reuseCutoff}
                  AND ck2.aadhaar_data IS NOT NULL
                  AND NOT IFNULL(JSON_CONTAINS(ck2.aadhaar_data, 'true', '$._vendorAttempt'), 0)
                  AND NOT IFNULL(JSON_CONTAINS(ck2.aadhaar_data, 'true', '$._identityMismatch'), 0)
                )
                OR (
                  COALESCE(ak.kyc_status, 0) = ${KYC_FAILED}
                  AND (ck2.aadhaar_data IS NOT NULL OR NULLIF(ck2.aadhaar_photo_path, '') IS NOT NULL)
                )
              )
            ORDER BY ck2.created_at DESC, ck2.id DESC
            LIMIT 1
          )
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
            ak.liveness_vendor_json AS livenessVendorJson,
            COALESCE(ak.is_liveness, false) AS livenessCheckCompleted,
            COALESCE(ak.liveness_attempts, 0) AS livenessAttempts,
            ad.loan_documents_accepted_at AS loanDocumentsAcceptedAt,
            ad.loan_documents_reviewed_at AS loanDocumentsReviewedAt
          FROM application a
          LEFT JOIN application_detail ad ON ad.application_id = a.id
          LEFT JOIN application_kyc ak ON ak.application_id = a.id
          LEFT JOIN customer_kyc ck ON ck.id = (
            SELECT ck2.id
            FROM customer_kyc ck2
            WHERE ck2.customer_id = a.customer_id
              AND (
                (ck2.aadhaar_verified_at IS NOT NULL AND ck2.aadhaar_verified_at >= a.created_at)
                OR (
                  ck2.aadhaar_verified_at IS NOT NULL
                  AND ck2.aadhaar_verified_at >= ${reuseCutoff}
                  AND ck2.aadhaar_data IS NOT NULL
                  AND NOT IFNULL(JSON_CONTAINS(ck2.aadhaar_data, 'true', '$._vendorAttempt'), 0)
                  AND NOT IFNULL(JSON_CONTAINS(ck2.aadhaar_data, 'true', '$._identityMismatch'), 0)
                )
                OR (
                  COALESCE(ak.kyc_status, 0) = ${KYC_FAILED}
                  AND (ck2.aadhaar_data IS NOT NULL OR NULLIF(ck2.aadhaar_photo_path, '') IS NOT NULL)
                )
              )
            ORDER BY ck2.created_at DESC, ck2.id DESC
            LIMIT 1
          )
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
