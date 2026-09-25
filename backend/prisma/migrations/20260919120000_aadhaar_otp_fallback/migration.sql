ALTER TABLE `customer_kyc`
  ADD COLUMN `aadhaar_kyc_process` VARCHAR(32) NULL AFTER `aadhaar_photo_path`;

UPDATE `customer_kyc`
SET `aadhaar_kyc_process` = 'DIGILOCKER'
WHERE `aadhaar_kyc_process` IS NULL
  AND (
    `aadhaar_verified_at` IS NOT NULL
    OR `aadhaar_data` IS NOT NULL
    OR `aadhaar_photo_path` IS NOT NULL
  );

ALTER TABLE `application_kyc`
  ADD COLUMN `aadhaar_otp_fallback_eligible` BOOLEAN NOT NULL DEFAULT false AFTER `digilocker_aadhaar_download_attempts`,
  ADD COLUMN `aadhaar_xml_otp_attempts` SMALLINT NOT NULL DEFAULT 0 AFTER `aadhaar_otp_fallback_eligible`;
