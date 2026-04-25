-- DropIndex
DROP INDEX `lead_is_active_idx` ON `lead`;

-- DropIndex
DROP INDEX `otp_type_is_active_idx` ON `otp_type`;

-- CreateTable
CREATE TABLE `bank` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- RenameIndex
ALTER TABLE `lead` RENAME INDEX `lead_source_id_fkey` TO `lead_source_id_idx`;
