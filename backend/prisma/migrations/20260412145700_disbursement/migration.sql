/*
  Warnings:

  - You are about to drop the column `pan_number` on the `application_details` table. All the data in the column will be lost.
  - You are about to alter the column `approved_amount` on the `application_eligibility` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(12,2)`.
  - You are about to drop the column `kyc_provider` on the `customer_kyc` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `application_details_pan_number_idx` ON `application_details`;

-- AlterTable
ALTER TABLE `application` ADD COLUMN `kyc_completed_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `application_details` DROP COLUMN `pan_number`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `gst_amount` DECIMAL(12, 2) NULL,
    ADD COLUMN `interest_amount` DECIMAL(12, 2) NULL,
    ADD COLUMN `interest_rate` DECIMAL(5, 2) NULL,
    ADD COLUMN `loan_disbursement_date` DATE NULL,
    ADD COLUMN `loan_maturity_date` DATE NULL,
    ADD COLUMN `loan_tenure` MEDIUMINT NULL,
    ADD COLUMN `processing_fee` DECIMAL(5, 2) NULL,
    ADD COLUMN `processing_fee_amount` DECIMAL(12, 2) NULL,
    ADD COLUMN `updated_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `application_eligibility` MODIFY `approved_amount` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `customer_kyc` DROP COLUMN `kyc_provider`;

-- AlterTable
ALTER TABLE `lead_detail` ADD COLUMN `pan_number` CHAR(10) NULL;

-- CreateTable
CREATE TABLE `kyc_provider` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `kyc_provider_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_document` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `kyc_document_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_kyc_document` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `customer_kyc_id` BIGINT UNSIGNED NOT NULL,
    `document_type_id` SMALLINT NOT NULL,
    `kyc_provider_id` SMALLINT NOT NULL,
    `file_name` VARCHAR(255) NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `customer_kyc_document_uuid_key`(`uuid`),
    INDEX `customer_kyc_document_customer_kyc_id_idx`(`customer_kyc_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_agreement` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `application_id` BIGINT UNSIGNED NOT NULL,
    `document_name` VARCHAR(255) NULL,
    `ip_address` VARCHAR(45) NULL,
    `signed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `application_agreement_uuid_key`(`uuid`),
    UNIQUE INDEX `application_agreement_application_id_key`(`application_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_disbursement` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `application_id` BIGINT UNSIGNED NOT NULL,
    `amount` DECIMAL(12, 2) NULL,
    `account_number` VARCHAR(20) NULL,
    `ifsc_code` VARCHAR(11) NULL,
    `utr` VARCHAR(50) NULL,
    `disbursed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `application_disbursement_uuid_key`(`uuid`),
    UNIQUE INDEX `application_disbursement_application_id_key`(`application_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `customer_kyc_document` ADD CONSTRAINT `customer_kyc_document_customer_kyc_id_fkey` FOREIGN KEY (`customer_kyc_id`) REFERENCES `customer_kyc`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_kyc_document` ADD CONSTRAINT `customer_kyc_document_kyc_provider_id_fkey` FOREIGN KEY (`kyc_provider_id`) REFERENCES `kyc_provider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_kyc_document` ADD CONSTRAINT `customer_kyc_document_document_type_id_fkey` FOREIGN KEY (`document_type_id`) REFERENCES `kyc_document`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_agreement` ADD CONSTRAINT `application_agreement_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_disbursement` ADD CONSTRAINT `application_disbursement_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
