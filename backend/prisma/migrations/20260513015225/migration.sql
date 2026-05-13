/*
  Warnings:

  - You are about to drop the column `email` on the `lead` table. All the data in the column will be lost.
  - You are about to drop the column `email_verification_type` on the `lead` table. All the data in the column will be lost.
  - You are about to drop the column `pan_number` on the `lead_detail` table. All the data in the column will be lost.
  - You are about to drop the column `pan_verification_note` on the `lead_detail` table. All the data in the column will be lost.
  - You are about to drop the column `pan_verified` on the `lead_detail` table. All the data in the column will be lost.
  - You are about to drop the column `pan_verified_at` on the `lead_detail` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `lead_email_idx` ON `lead`;

-- DropIndex
DROP INDEX `lead_detail_pan_verified_pan_verified_at_idx` ON `lead_detail`;

-- AlterTable
ALTER TABLE `lead` DROP COLUMN `email`,
    DROP COLUMN `email_verification_type`,
    ADD COLUMN `bureau_fetched` SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN `bureau_fetched_at` DATETIME(3) NULL,
    ADD COLUMN `bureau_fetched_note` VARCHAR(500) NULL,
    ADD COLUMN `pan_number` CHAR(10) NULL,
    ADD COLUMN `pan_verification_note` VARCHAR(500) NULL,
    ADD COLUMN `pan_verified` SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN `pan_verified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `lead_detail` DROP COLUMN `pan_number`,
    DROP COLUMN `pan_verification_note`,
    DROP COLUMN `pan_verified`,
    DROP COLUMN `pan_verified_at`;

-- CreateIndex
CREATE INDEX `lead_pan_verified_pan_verified_at_idx` ON `lead`(`pan_verified`, `pan_verified_at`);
