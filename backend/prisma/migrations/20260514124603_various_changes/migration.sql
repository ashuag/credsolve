/*
  Warnings:

  - You are about to alter the column `email_verified_at` on the `application` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `application` ADD COLUMN `aadhaar_photo_relative_path` VARCHAR(512) NULL,
    ADD COLUMN `digilocker_aadhaar_form_json` JSON NULL,
    ADD COLUMN `kyc_status` SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN `liveness_checked_at` DATETIME(3) NULL,
    ADD COLUMN `liveness_passed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `liveness_vendor_json` JSON NULL,
    ADD COLUMN `selfie_relative_path` VARCHAR(512) NULL,
    MODIFY `email_verified_at` DATETIME NULL;
