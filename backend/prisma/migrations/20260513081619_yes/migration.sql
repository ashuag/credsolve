/*
  Warnings:

  - You are about to alter the column `email_verified_at` on the `application` table. The data in that column could be lost. The data in that column will be cast from `DateTime(3)` to `DateTime`.
  - You are about to drop the column `pan_verification_note` on the `lead` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `application` MODIFY `email_verified_at` DATETIME NULL;

-- AlterTable
ALTER TABLE `lead` DROP COLUMN `pan_verification_note`;
