/*
  Warnings:

  - You are about to drop the `otp_log` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `otp_log` DROP FOREIGN KEY `otp_log_type_id_fkey`;

-- DropTable
DROP TABLE `otp_log`;

-- CreateTable
CREATE TABLE `otp_request` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `value` VARCHAR(100) NOT NULL,
    `type_id` SMALLINT NOT NULL,
    `otp_code` VARCHAR(6) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `attempt_count` SMALLINT NOT NULL DEFAULT 0,
    `last_sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `utm_source` VARCHAR(100) NULL,
    `utm_medium` VARCHAR(100) NULL,
    `utm_campaign` VARCHAR(100) NULL,
    `utm_term` VARCHAR(100) NULL,
    `utm_content` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verified_at` DATETIME(3) NULL,

    UNIQUE INDEX `otp_request_uuid_key`(`uuid`),
    INDEX `otp_request_value_type_id_idx`(`value`, `type_id`),
    INDEX `otp_request_expires_at_idx`(`expires_at`),
    INDEX `otp_request_verified_at_idx`(`verified_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `otp_request` ADD CONSTRAINT `otp_request_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `otp_type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
