/*
  Warnings:

  - You are about to alter the column `email_verified_at` on the `application` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `application` MODIFY `email_verified_at` DATETIME NULL;

-- CreateTable
CREATE TABLE `bureau_report` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `lead_id` BIGINT UNSIGNED NOT NULL,
    `cibil_score` INTEGER NULL,
    `html_url` TEXT NULL,
    `vendor_request_id` VARCHAR(64) NULL,
    `service_status_code` SMALLINT NULL,
    `response_status` VARCHAR(64) NULL,
    `raw_payload` JSON NULL,
    `dummy_fetched` BOOLEAN NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `bureau_report_uuid_key`(`uuid`),
    INDEX `bureau_report_customer_id_created_at_idx`(`customer_id`, `created_at`),
    INDEX `bureau_report_lead_id_created_at_idx`(`lead_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bureau_report` ADD CONSTRAINT `bureau_report_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bureau_report` ADD CONSTRAINT `bureau_report_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
