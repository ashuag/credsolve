-- Create replacement index first (FK on lead_source_id needs an index to remain valid)
CREATE INDEX `source_utm_lead_source_id_idx` ON `source_utm` (`lead_source_id`);

-- Now drop the old composite unique key and type-based index
ALTER TABLE `source_utm`
  DROP INDEX `source_utm_lead_source_id_type_name_key`,
  DROP INDEX `source_utm_lead_source_id_type_idx`;

-- Remove old columns and add new ones
ALTER TABLE `source_utm`
  DROP COLUMN `type`,
  DROP COLUMN `name`,
  ADD COLUMN `utm_campaign` VARCHAR(100) NULL,
  ADD COLUMN `utm_term`     VARCHAR(100) NULL,
  ADD COLUMN `utm_medium`   VARCHAR(100) NULL,
  ADD COLUMN `utm_content`  VARCHAR(100) NULL,
  ADD COLUMN `created_by`   BIGINT UNSIGNED NULL,
  ADD COLUMN `updated_by`   BIGINT UNSIGNED NULL;

-- Add FK constraints for audit columns
ALTER TABLE `source_utm`
  ADD CONSTRAINT `source_utm_created_by_fkey`
    FOREIGN KEY (`created_by`) REFERENCES `user` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `source_utm_updated_by_fkey`
    FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
