-- Move PAN / bureau / validation fields from `lead` to `lead_detail`.

ALTER TABLE `lead_detail`
  ADD COLUMN `pan_number` CHAR(10) NULL AFTER `cibil_consent_at`,
  ADD COLUMN `pan_verified` SMALLINT NOT NULL DEFAULT 0 AFTER `pan_number`,
  ADD COLUMN `pan_verified_at` DATETIME(3) NULL AFTER `pan_verified`,
  ADD COLUMN `pan_validation_attempts` SMALLINT NOT NULL DEFAULT 0 AFTER `pan_verified_at`,
  ADD COLUMN `bureau_fetched` SMALLINT NOT NULL DEFAULT 0 AFTER `pan_validation_attempts`,
  ADD COLUMN `bureau_fetched_at` DATETIME(3) NULL AFTER `bureau_fetched`,
  ADD COLUMN `bureau_fetched_note` VARCHAR(500) NULL AFTER `bureau_fetched_at`;

UPDATE `lead_detail` ld
INNER JOIN `lead` l ON l.id = ld.lead_id
SET
  ld.pan_number = l.pan_number,
  ld.pan_verified = l.pan_verified,
  ld.pan_verified_at = l.pan_verified_at,
  ld.pan_validation_attempts = l.pan_validation_attempts,
  ld.bureau_fetched = l.bureau_fetched,
  ld.bureau_fetched_at = l.bureau_fetched_at,
  ld.bureau_fetched_note = l.bureau_fetched_note;

DROP INDEX `lead_pan_verified_pan_verified_at_idx` ON `lead`;

ALTER TABLE `lead`
  DROP COLUMN `pan_number`,
  DROP COLUMN `pan_verified`,
  DROP COLUMN `pan_verified_at`,
  DROP COLUMN `pan_validation_attempts`,
  DROP COLUMN `bureau_fetched`,
  DROP COLUMN `bureau_fetched_at`,
  DROP COLUMN `bureau_fetched_note`;

CREATE INDEX `lead_detail_pan_verified_pan_verified_at_idx` ON `lead_detail`(`pan_verified`, `pan_verified_at`);
