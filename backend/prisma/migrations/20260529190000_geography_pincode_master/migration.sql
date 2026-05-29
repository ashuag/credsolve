-- AlterTable
ALTER TABLE `city` ADD COLUMN `source_city_id` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `city_source_city_id_key` ON `city`(`source_city_id`);

-- CreateTable
CREATE TABLE `pincode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` CHAR(6) NOT NULL,
    `city_id` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pincode_code_key`(`code`),
    INDEX `pincode_city_id_idx`(`city_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pincode` ADD CONSTRAINT `pincode_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `city`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
