-- Apply when `vendor_api_log.request_path` is still VARCHAR(255) from older migrations.
-- Run as a DB user with ALTER on `vendor_api_log` (e.g. copy into `prisma/migrations/.../migration.sql` or run manually).
ALTER TABLE `vendor_api_log` MODIFY `request_path` TEXT NULL;
