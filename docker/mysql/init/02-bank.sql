-- Bank master (matches Prisma `Bank` / @@map("bank")). Safe on first MySQL init only.
CREATE TABLE IF NOT EXISTS `bank` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `bank_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
