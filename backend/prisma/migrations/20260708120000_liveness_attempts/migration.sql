ALTER TABLE `application_kyc` ADD COLUMN `liveness_attempts` SMALLINT NOT NULL DEFAULT 0 AFTER `digilocker_aadhaar_download_attempts`;
