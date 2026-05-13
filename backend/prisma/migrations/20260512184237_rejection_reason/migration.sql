-- AlterTable
ALTER TABLE `lead` ADD COLUMN `rejection_reason_id` SMALLINT NULL;

-- CreateTable
CREATE TABLE `rejection_reason` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `rejection_reason_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `lead_rejection_reason_id_idx` ON `lead`(`rejection_reason_id`);

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_rejection_reason_id_fkey` FOREIGN KEY (`rejection_reason_id`) REFERENCES `rejection_reason`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
