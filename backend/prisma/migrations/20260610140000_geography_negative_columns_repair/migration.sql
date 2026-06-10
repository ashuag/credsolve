-- Repair DBs where 20260530110000 ran the old partial version (dropped negative_*
-- tables but never added is_negative columns on state/city/pincode).
-- No-op when those columns already exist (fresh deploy with the full migration).

SET @db = DATABASE();

-- state negative columns
SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'state' AND COLUMN_NAME = 'is_negative'
);
SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `state`
     ADD COLUMN `is_negative` BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN `negative_reason` VARCHAR(500) NULL,
     ADD COLUMN `negative_added_by_user_id` BIGINT UNSIGNED NULL,
     ADD COLUMN `negative_added_at` DATETIME(3) NULL,
     ADD COLUMN `negative_removed_by_user_id` BIGINT UNSIGNED NULL,
     ADD COLUMN `negative_removed_at` DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- city negative columns
SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'city' AND COLUMN_NAME = 'is_negative'
);
SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `city`
     ADD COLUMN `is_negative` BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN `negative_reason` VARCHAR(500) NULL,
     ADD COLUMN `negative_added_by_user_id` BIGINT UNSIGNED NULL,
     ADD COLUMN `negative_added_at` DATETIME(3) NULL,
     ADD COLUMN `negative_removed_by_user_id` BIGINT UNSIGNED NULL,
     ADD COLUMN `negative_removed_at` DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- pincode negative columns
SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pincode' AND COLUMN_NAME = 'is_negative'
);
SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `pincode`
     ADD COLUMN `is_negative` BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN `negative_reason` VARCHAR(500) NULL,
     ADD COLUMN `negative_added_by_user_id` BIGINT UNSIGNED NULL,
     ADD COLUMN `negative_added_at` DATETIME(3) NULL,
     ADD COLUMN `negative_removed_by_user_id` BIGINT UNSIGNED NULL,
     ADD COLUMN `negative_removed_at` DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- FK: state_negative_added_by_user_id_fkey
SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'state'
    AND CONSTRAINT_NAME = 'state_negative_added_by_user_id_fkey'
);
SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `state`
     ADD CONSTRAINT `state_negative_added_by_user_id_fkey`
       FOREIGN KEY (`negative_added_by_user_id`) REFERENCES `user`(`id`)
       ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'state'
    AND CONSTRAINT_NAME = 'state_negative_removed_by_user_id_fkey'
);
SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `state`
     ADD CONSTRAINT `state_negative_removed_by_user_id_fkey`
       FOREIGN KEY (`negative_removed_by_user_id`) REFERENCES `user`(`id`)
       ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- FK: city
SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'city'
    AND CONSTRAINT_NAME = 'city_negative_added_by_user_id_fkey'
);
SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `city`
     ADD CONSTRAINT `city_negative_added_by_user_id_fkey`
       FOREIGN KEY (`negative_added_by_user_id`) REFERENCES `user`(`id`)
       ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'city'
    AND CONSTRAINT_NAME = 'city_negative_removed_by_user_id_fkey'
);
SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `city`
     ADD CONSTRAINT `city_negative_removed_by_user_id_fkey`
       FOREIGN KEY (`negative_removed_by_user_id`) REFERENCES `user`(`id`)
       ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- FK: pincode
SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'pincode'
    AND CONSTRAINT_NAME = 'pincode_negative_added_by_user_id_fkey'
);
SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `pincode`
     ADD CONSTRAINT `pincode_negative_added_by_user_id_fkey`
       FOREIGN KEY (`negative_added_by_user_id`) REFERENCES `user`(`id`)
       ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'pincode'
    AND CONSTRAINT_NAME = 'pincode_negative_removed_by_user_id_fkey'
);
SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `pincode`
     ADD CONSTRAINT `pincode_negative_removed_by_user_id_fkey`
       FOREIGN KEY (`negative_removed_by_user_id`) REFERENCES `user`(`id`)
       ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
