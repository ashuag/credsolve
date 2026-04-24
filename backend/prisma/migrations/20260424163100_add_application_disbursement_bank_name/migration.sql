-- Add missing bank_name column expected by Prisma schema and session query.
ALTER TABLE `application_disbursement`
  ADD COLUMN `bank_name` VARCHAR(100) NULL AFTER `ifsc_code`;
