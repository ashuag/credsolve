-- Vendor API registry (primary / backup) with on/off status for LOS.
CREATE TABLE `vendor_api_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `api_code` VARCHAR(64) NOT NULL,
    `api_name` VARCHAR(120) NOT NULL,
    `vendor_name` VARCHAR(80) NOT NULL,
    `priority` SMALLINT NOT NULL DEFAULT 1,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `notes` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `vendor_api_config_api_vendor_uq` ON `vendor_api_config`(`api_code`, `vendor_name`);
CREATE INDEX `vendor_api_config_api_status_priority_idx` ON `vendor_api_config`(`api_code`, `status`, `priority`);
