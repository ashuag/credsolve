-- Restructure application aggregate: application_details, application_kyc,
-- application_reference; slim application; reshape customer_kyc.

-- ---------------------------------------------------------------------------
-- loan_detail → application_details (+ email / loan-doc / penny-drop fields)
-- ---------------------------------------------------------------------------
-- Idempotent rename (MySQL renames indexes to application_details_* on rename).
SET @rename_sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loan_detail'
    ),
    'RENAME TABLE `loan_detail` TO `application_details`',
    'SELECT 1'
  )
);
PREPARE _migrate_rename_stmt FROM @rename_sql;
EXECUTE _migrate_rename_stmt;
DEALLOCATE PREPARE _migrate_rename_stmt;

ALTER TABLE `application_details`
  DROP INDEX `application_details_uuid_key`,
  DROP COLUMN `uuid`,
  CHANGE COLUMN `interest_rate_percentage` `interest_rate` DECIMAL(5, 2) NULL,
  ADD COLUMN `email_id` VARCHAR(150) NULL AFTER `application_id`,
  ADD COLUMN `email_verification_type` ENUM('GOOGLE', 'OTP') NULL AFTER `email_id`,
  ADD COLUMN `email_verified_at` DATETIME(3) NULL AFTER `email_verification_type`,
  ADD COLUMN `key_fact_pdf_relative_path` VARCHAR(512) NULL AFTER `bank_name`,
  ADD COLUMN `key_fact_esigned` BOOLEAN NOT NULL DEFAULT false AFTER `key_fact_pdf_relative_path`,
  ADD COLUMN `loan_agreement_pdf_relative_path` VARCHAR(512) NULL AFTER `key_fact_esigned`,
  ADD COLUMN `loan_documents_accepted_at` DATETIME(3) NULL AFTER `loan_agreement_pdf_relative_path`,
  ADD COLUMN `penny_drop_attempts` SMALLINT NOT NULL DEFAULT 0 AFTER `loan_documents_accepted_at`;

UPDATE `application_details` ad
INNER JOIN `application` a ON a.id = ad.application_id
SET
  ad.email_id = a.email_id,
  ad.email_verification_type = a.email_verification_type,
  ad.email_verified_at = a.email_verified_at,
  ad.key_fact_pdf_relative_path = a.key_fact_pdf_relative_path,
  ad.key_fact_esigned = a.key_fact_esigned,
  ad.loan_agreement_pdf_relative_path = a.loan_agreement_pdf_relative_path,
  ad.loan_documents_accepted_at = a.loan_documents_accepted_at,
  ad.penny_drop_attempts = a.penny_drop_attempts;

-- ---------------------------------------------------------------------------
-- application_kyc (selfie / liveness / face-match from application)
-- ---------------------------------------------------------------------------
CREATE TABLE `application_kyc` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `kyc_status` SMALLINT NOT NULL DEFAULT 0,
  `liveness_selfie_path` VARCHAR(512) NULL,
  `is_liveness` BOOLEAN NOT NULL DEFAULT false,
  `liveness_checked_at` DATETIME(3) NULL,
  `liveness_done_at` DATETIME(3) NULL,
  `liveness_passed` BOOLEAN NOT NULL DEFAULT false,
  `liveness_vendor_json` JSON NULL,
  `face_match_checked_at` DATETIME(3) NULL,
  `selfie_face_validation_json` JSON NULL,
  `selfie_face_validation_passed` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `application_kyc_application_id_key`(`application_id`),
  CONSTRAINT `application_kyc_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `application_kyc` (
  `application_id`,
  `kyc_status`,
  `liveness_selfie_path`,
  `is_liveness`,
  `liveness_checked_at`,
  `liveness_done_at`,
  `liveness_passed`,
  `liveness_vendor_json`,
  `face_match_checked_at`,
  `selfie_face_validation_json`,
  `selfie_face_validation_passed`,
  `created_at`,
  `updated_at`
)
SELECT
  a.id,
  a.kyc_status,
  a.selfie_relative_path,
  a.liveness_done,
  a.liveness_checked_at,
  a.liveness_done_at,
  a.liveness_passed,
  a.liveness_vendor_json,
  a.selfie_face_validation_checked_at,
  a.selfie_face_validation_json,
  a.selfie_face_validation_passed,
  a.created_at,
  NOW(3)
FROM `application` a;

-- ---------------------------------------------------------------------------
-- customer_kyc reshape + migrate Aadhaar from application
-- ---------------------------------------------------------------------------
ALTER TABLE `customer_kyc`
  DROP INDEX `customer_kyc_uuid_key`,
  DROP INDEX `customer_kyc_pan_number_idx`,
  DROP INDEX `customer_kyc_kyc_verified_at_idx`,
  DROP INDEX `customer_kyc_expires_at_idx`,
  DROP COLUMN `uuid`,
  DROP COLUMN `full_name`,
  DROP COLUMN `date_of_birth`,
  DROP COLUMN `kyc_verified_at`,
  DROP COLUMN `expires_at`,
  DROP COLUMN `updated_at`,
  CHANGE COLUMN `pan_number` `pan_card_number` CHAR(10) NULL,
  CHANGE COLUMN `pan_verified_at` `pan_card_verified_at` DATETIME(3) NULL,
  ADD COLUMN `aadhaar_verified_at` DATETIME(3) NULL AFTER `pan_card_verified_at`,
  ADD COLUMN `aadhaar_data` JSON NULL AFTER `aadhaar_verified_at`,
  ADD COLUMN `aadhaar_photo_path` VARCHAR(512) NULL AFTER `aadhaar_data`,
  ADD INDEX `customer_kyc_pan_card_number_idx`(`pan_card_number`);

UPDATE `customer_kyc` ck
INNER JOIN (
  SELECT
    a.customer_id,
    a.digilocker_aadhaar_form_json,
    a.aadhaar_photo_relative_path,
    a.kyc_completed_at,
    ROW_NUMBER() OVER (PARTITION BY a.customer_id ORDER BY a.created_at DESC) AS rn
  FROM `application` a
  WHERE a.digilocker_aadhaar_form_json IS NOT NULL
     OR a.aadhaar_photo_relative_path IS NOT NULL
) latest ON latest.customer_id = ck.customer_id AND latest.rn = 1
SET
  ck.aadhaar_data = latest.digilocker_aadhaar_form_json,
  ck.aadhaar_photo_path = latest.aadhaar_photo_relative_path,
  ck.aadhaar_verified_at = latest.kyc_completed_at;

DROP TABLE IF EXISTS `customer_kyc_document`;

-- ---------------------------------------------------------------------------
-- application_reference (from lead_reference via latest application per lead)
-- ---------------------------------------------------------------------------
CREATE TABLE `application_reference` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `reference_index` SMALLINT NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `mobile_number` VARCHAR(10) NOT NULL,
  `relation_id` SMALLINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `application_reference_application_id_reference_index_key`(`application_id`, `reference_index`),
  INDEX `application_reference_application_id_idx`(`application_id`),
  CONSTRAINT `application_reference_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `application_reference_relation_id_fkey` FOREIGN KEY (`relation_id`) REFERENCES `reference_relation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `application_reference` (
  `application_id`,
  `reference_index`,
  `full_name`,
  `mobile_number`,
  `relation_id`,
  `created_at`,
  `updated_at`
)
SELECT
  app.id,
  lr.reference_index,
  lr.full_name,
  lr.mobile_number,
  lr.relation_id,
  lr.created_at,
  lr.updated_at
FROM `lead_reference` lr
INNER JOIN `application` app ON app.lead_id = lr.lead_id
INNER JOIN (
  SELECT lead_id, MAX(id) AS max_app_id
  FROM `application`
  GROUP BY lead_id
) latest ON latest.max_app_id = app.id;

DROP TABLE `lead_reference`;

-- ---------------------------------------------------------------------------
-- Slim application
-- ---------------------------------------------------------------------------
ALTER TABLE `application`
  ADD COLUMN `application_status_note` VARCHAR(256) NULL AFTER `pre_approved_loan_amount`,
  ADD COLUMN `rejection_reason_id` SMALLINT NULL AFTER `application_status_note`,
  ADD INDEX `application_rejection_reason_id_idx`(`rejection_reason_id`),
  ADD CONSTRAINT `application_rejection_reason_id_fkey` FOREIGN KEY (`rejection_reason_id`) REFERENCES `rejection_reason`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `application`
  DROP COLUMN `email_id`,
  DROP COLUMN `email_verified_at`,
  DROP COLUMN `email_verification_type`,
  DROP COLUMN `kyc_status`,
  DROP COLUMN `digilocker_aadhaar_form_json`,
  DROP COLUMN `aadhaar_photo_relative_path`,
  DROP COLUMN `selfie_relative_path`,
  DROP COLUMN `selfie_face_validation_json`,
  DROP COLUMN `selfie_face_validation_passed`,
  DROP COLUMN `selfie_face_validation_checked_at`,
  DROP COLUMN `liveness_vendor_json`,
  DROP COLUMN `liveness_checked_at`,
  DROP COLUMN `liveness_passed`,
  DROP COLUMN `liveness_done`,
  DROP COLUMN `liveness_done_at`,
  DROP COLUMN `key_fact_pdf_relative_path`,
  DROP COLUMN `key_fact_esigned`,
  DROP COLUMN `loan_agreement_pdf_relative_path`,
  DROP COLUMN `loan_documents_accepted_at`,
  DROP COLUMN `penny_drop_attempts`;
