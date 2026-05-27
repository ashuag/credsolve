/*
  Warnings:

  - You are about to alter the column `email_verified_at` on the `application` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `application` MODIFY `email_verified_at` DATETIME NULL,
    MODIFY `loan_documents_accepted_at` DATETIME(3) NULL;
