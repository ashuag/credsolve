ALTER TABLE `lead`
  ADD COLUMN `pan_validation_attempts` SMALLINT NOT NULL DEFAULT 0
  AFTER `pan_verified_at`;
