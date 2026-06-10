-- Consolidate negative_state / negative_city / negative_pincode into flags on the main
-- geography masters (state, city, pincode).

-- AlterTable
ALTER TABLE `state`
  ADD COLUMN `is_negative` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `negative_reason` VARCHAR(500) NULL,
  ADD COLUMN `negative_added_by_user_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `negative_added_at` DATETIME(3) NULL,
  ADD COLUMN `negative_removed_by_user_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `negative_removed_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `city`
  ADD COLUMN `is_negative` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `negative_reason` VARCHAR(500) NULL,
  ADD COLUMN `negative_added_by_user_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `negative_added_at` DATETIME(3) NULL,
  ADD COLUMN `negative_removed_by_user_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `negative_removed_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `pincode`
  ADD COLUMN `is_negative` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `negative_reason` VARCHAR(500) NULL,
  ADD COLUMN `negative_added_by_user_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `negative_added_at` DATETIME(3) NULL,
  ADD COLUMN `negative_removed_by_user_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `negative_removed_at` DATETIME(3) NULL;

-- Copy existing negative-state rows onto the state master.
UPDATE `state` s
INNER JOIN `negative_state` ns ON ns.`state_id` = s.`id`
SET
  s.`is_negative` = ns.`is_active`,
  s.`negative_reason` = ns.`reason`,
  s.`negative_added_by_user_id` = ns.`added_by_user_id`,
  s.`negative_added_at` = ns.`created_at`,
  s.`negative_removed_by_user_id` = IF(ns.`is_active`, NULL, ns.`removed_by_user_id`),
  s.`negative_removed_at` = IF(ns.`is_active`, NULL, ns.`removed_at`);

-- Copy existing negative-city rows onto the city master.
UPDATE `city` c
INNER JOIN `negative_city` nc ON nc.`city_id` = c.`id`
SET
  c.`is_negative` = nc.`is_active`,
  c.`negative_reason` = nc.`reason`,
  c.`negative_added_by_user_id` = nc.`added_by_user_id`,
  c.`negative_added_at` = nc.`created_at`,
  c.`negative_removed_by_user_id` = IF(nc.`is_active`, NULL, nc.`removed_by_user_id`),
  c.`negative_removed_at` = IF(nc.`is_active`, NULL, nc.`removed_at`);

-- Copy existing negative-pincode rows onto the pincode master (match by 6-digit code).
UPDATE `pincode` p
INNER JOIN `negative_pincode` np ON np.`pincode` = p.`code`
SET
  p.`is_negative` = np.`is_active`,
  p.`negative_reason` = np.`reason`,
  p.`negative_added_by_user_id` = np.`added_by_user_id`,
  p.`negative_added_at` = np.`created_at`,
  p.`negative_removed_by_user_id` = IF(np.`is_active`, NULL, np.`removed_by_user_id`),
  p.`negative_removed_at` = IF(np.`is_active`, NULL, np.`removed_at`);

-- AddForeignKey
ALTER TABLE `state`
  ADD CONSTRAINT `state_negative_added_by_user_id_fkey`
    FOREIGN KEY (`negative_added_by_user_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `state_negative_removed_by_user_id_fkey`
    FOREIGN KEY (`negative_removed_by_user_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `city`
  ADD CONSTRAINT `city_negative_added_by_user_id_fkey`
    FOREIGN KEY (`negative_added_by_user_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `city_negative_removed_by_user_id_fkey`
    FOREIGN KEY (`negative_removed_by_user_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pincode`
  ADD CONSTRAINT `pincode_negative_added_by_user_id_fkey`
    FOREIGN KEY (`negative_added_by_user_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `pincode_negative_removed_by_user_id_fkey`
    FOREIGN KEY (`negative_removed_by_user_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop FK constraints on the old negative tables
ALTER TABLE `negative_state`
  DROP FOREIGN KEY `negative_state_state_id_fkey`,
  DROP FOREIGN KEY `negative_state_added_by_user_id_fkey`,
  DROP FOREIGN KEY `negative_state_removed_by_user_id_fkey`;

ALTER TABLE `negative_city`
  DROP FOREIGN KEY `negative_city_city_id_fkey`,
  DROP FOREIGN KEY `negative_city_added_by_user_id_fkey`,
  DROP FOREIGN KEY `negative_city_removed_by_user_id_fkey`;

ALTER TABLE `negative_pincode`
  DROP FOREIGN KEY `negative_pincode_added_by_user_id_fkey`,
  DROP FOREIGN KEY `negative_pincode_removed_by_user_id_fkey`;

-- Drop the old negative tables
DROP TABLE `negative_state`;
DROP TABLE `negative_city`;
DROP TABLE `negative_pincode`;
