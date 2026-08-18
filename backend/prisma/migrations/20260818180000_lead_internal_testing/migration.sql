-- Hide internal-testing journeys from LOS lead/application listings and dumps.
ALTER TABLE `lead`
  ADD COLUMN `is_internal_testing` BOOLEAN NOT NULL DEFAULT false AFTER `is_active`;

CREATE INDEX `lead_is_internal_testing_idx` ON `lead`(`is_internal_testing`);
