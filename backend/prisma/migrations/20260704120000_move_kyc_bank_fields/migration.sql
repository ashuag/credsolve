-- Move digilocker_aadhaar_download_attempts (lead → application_kyc),
-- kyc_completed_at (application → application_kyc), and add penny_drop_vendor_json
-- on application_details.

ALTER TABLE `application_kyc`
  ADD COLUMN `digilocker_aadhaar_download_attempts` SMALLINT NOT NULL DEFAULT 0
    AFTER `selfie_face_validation_passed`,
  ADD COLUMN `kyc_completed_at` DATETIME(3) NULL
    AFTER `digilocker_aadhaar_download_attempts`;

UPDATE `application_kyc` ak
INNER JOIN `application` a ON a.id = ak.application_id
INNER JOIN (
  SELECT `lead_id`, MAX(`id`) AS `max_app_id`
  FROM `application`
  GROUP BY `lead_id`
) latest ON latest.`max_app_id` = a.`id`
INNER JOIN `lead` l ON l.`id` = a.`lead_id`
SET ak.`digilocker_aadhaar_download_attempts` = l.`digilocker_aadhaar_download_attempts`;

UPDATE `application_kyc` ak
INNER JOIN `application` a ON a.id = ak.application_id
SET ak.`kyc_completed_at` = a.`kyc_completed_at`;

UPDATE `customer_kyc` ck
INNER JOIN (
  SELECT
    a.`customer_id`,
    ak.`kyc_completed_at`,
    ROW_NUMBER() OVER (PARTITION BY a.`customer_id` ORDER BY a.`created_at` DESC) AS rn
  FROM `application_kyc` ak
  INNER JOIN `application` a ON a.`id` = ak.`application_id`
  WHERE ak.`kyc_completed_at` IS NOT NULL
) latest ON latest.`customer_id` = ck.`customer_id` AND latest.rn = 1
SET ck.`aadhaar_verified_at` = COALESCE(ck.`aadhaar_verified_at`, latest.`kyc_completed_at`);

ALTER TABLE `lead`
  DROP COLUMN `digilocker_aadhaar_download_attempts`;

ALTER TABLE `application`
  DROP COLUMN `kyc_completed_at`;

ALTER TABLE `application_details`
  ADD COLUMN `penny_drop_vendor_json` JSON NULL AFTER `penny_drop_attempts`;
