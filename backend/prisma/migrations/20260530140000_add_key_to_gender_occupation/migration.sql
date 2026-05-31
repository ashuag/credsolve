-- Add key column to gender table
ALTER TABLE `gender` ADD COLUMN `key` VARCHAR(20) NOT NULL DEFAULT '' AFTER `id`;
UPDATE `gender` SET `key` = UPPER(REPLACE(`name`, ' ', '_'));
ALTER TABLE `gender` ADD UNIQUE INDEX `gender_key_key`(`key`);
ALTER TABLE `gender` MODIFY COLUMN `key` VARCHAR(20) NOT NULL;

-- Add key column to occupation table
ALTER TABLE `occupation` ADD COLUMN `key` VARCHAR(50) NOT NULL DEFAULT '' AFTER `id`;
UPDATE `occupation` SET `key` = UPPER(REPLACE(`name`, ' ', '_'));
-- Fix: 'Students' -> 'STUDENT' (name is plural in DB but key should be singular)
UPDATE `occupation` SET `key` = 'STUDENT' WHERE `name` = 'Students';
ALTER TABLE `occupation` ADD UNIQUE INDEX `occupation_key_key`(`key`);
ALTER TABLE `occupation` MODIFY COLUMN `key` VARCHAR(50) NOT NULL;
