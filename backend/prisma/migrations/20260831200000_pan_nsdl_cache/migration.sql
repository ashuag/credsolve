-- Success-only Tenacio NSDL PAN cache (pan + name + DOB). Customer pointer
-- lets recurring applicants skip the vendor when pan_nsdl_cache_id is set.

CREATE TABLE `pan_nsdl` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `pan_number` CHAR(10) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `date_of_birth` DATE NOT NULL,
    `nsdl_response` JSON NOT NULL,
    `name_verified` BOOLEAN NOT NULL,
    `verified_at` DATETIME(3) NOT NULL,
    `vendor_request_id` VARCHAR(128) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pan_nsdl_uuid_key`(`uuid`),
    UNIQUE INDEX `pan_nsdl_identity_key`(`pan_number`, `date_of_birth`, `full_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customer`
    ADD COLUMN `pan_nsdl_cache_id` BIGINT UNSIGNED NULL,
    ADD INDEX `customer_pan_nsdl_cache_id_idx`(`pan_nsdl_cache_id`);

ALTER TABLE `customer`
    ADD CONSTRAINT `customer_pan_nsdl_cache_id_fkey`
    FOREIGN KEY (`pan_nsdl_cache_id`) REFERENCES `pan_nsdl`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
