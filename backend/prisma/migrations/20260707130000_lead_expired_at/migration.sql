-- `expires_at` stored a planned expiry at lead creation; `expired_at` is set when the lead is marked EXPIRED.

DROP INDEX `lead_expires_at_idx` ON `lead`;

ALTER TABLE `lead`
  CHANGE COLUMN `expires_at` `expired_at` DATETIME(3) NULL;

UPDATE `lead` SET `expired_at` = NULL;

CREATE INDEX `lead_expired_at_idx` ON `lead`(`expired_at`);
