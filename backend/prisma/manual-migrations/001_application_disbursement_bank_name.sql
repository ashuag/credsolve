-- Run once if `application_disbursement` has no `bank_name` column (older DBs).
-- Safe to run multiple times if your MySQL version supports IF NOT EXISTS checks manually.

ALTER TABLE `application_disbursement`
  ADD COLUMN `bank_name` VARCHAR(100) NULL AFTER `ifsc_code`;
