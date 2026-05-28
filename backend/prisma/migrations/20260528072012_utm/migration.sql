/*
  Warnings:

  - You are about to alter the column `email_verified_at` on the `application` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to drop the `utm_campaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `utm_medium` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `utm_source` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `utm_campaign` DROP FOREIGN KEY `utm_campaign_lead_source_id_fkey`;

-- DropForeignKey
ALTER TABLE `utm_medium` DROP FOREIGN KEY `utm_medium_lead_source_id_fkey`;

-- DropForeignKey
ALTER TABLE `utm_source` DROP FOREIGN KEY `utm_source_lead_source_id_fkey`;

-- AlterTable
ALTER TABLE `application` MODIFY `email_verified_at` DATETIME NULL,
    MODIFY `loan_documents_accepted_at` DATETIME(3) NULL;

-- DropTable
DROP TABLE `utm_campaign`;

-- DropTable
DROP TABLE `utm_medium`;

-- DropTable
DROP TABLE `utm_source`;

-- CreateTable
CREATE TABLE `source_utm` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `lead_source_id` INTEGER NOT NULL,
    `type` ENUM('SOURCE', 'MEDIUM', 'CAMPAIGN') NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `source_utm_lead_source_id_type_idx`(`lead_source_id`, `type`),
    UNIQUE INDEX `source_utm_lead_source_id_type_name_key`(`lead_source_id`, `type`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `source_utm` ADD CONSTRAINT `source_utm_lead_source_id_fkey` FOREIGN KEY (`lead_source_id`) REFERENCES `lead_source`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
