ALTER TABLE `lead` ADD COLUMN `digilocker_aadhaar_download_attempts` SMALLINT NOT NULL DEFAULT 0 AFTER `pan_validation_attempts`;
