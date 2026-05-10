-- AlterTable
ALTER TABLE `lead_detail` ADD COLUMN `pan_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `pan_verified_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `vendor_api_log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `provider_name` VARCHAR(100) NOT NULL,
    `service_name` VARCHAR(120) NOT NULL,
    `lead_id` BIGINT UNSIGNED NULL,
    `request_payload` JSON NOT NULL,
    `response_payload` JSON NULL,
    `http_status` INTEGER NULL,
    `requested_at` DATETIME(3) NOT NULL,
    `responded_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendor_api_log_uuid_key`(`uuid`),
    INDEX `vendor_api_log_lead_id_idx`(`lead_id`),
    INDEX `vendor_api_log_provider_name_requested_at_idx`(`provider_name`, `requested_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vendor_api_log` ADD CONSTRAINT `vendor_api_log_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
