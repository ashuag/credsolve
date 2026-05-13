-- AlterTable
ALTER TABLE `application` ADD COLUMN `email_id` VARCHAR(150) NULL,
    ADD COLUMN `email_verification_type` ENUM('GOOGLE', 'OTP') NULL,
    ADD COLUMN `email_verified_at` DATETIME(3) NULL;
