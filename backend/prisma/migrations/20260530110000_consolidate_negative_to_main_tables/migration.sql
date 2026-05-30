-- NOTE: ADD COLUMN and ADD CONSTRAINT statements for state/city/pincode already ran
-- during the first (failed) attempt. This re-run only performs the remaining work.

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
