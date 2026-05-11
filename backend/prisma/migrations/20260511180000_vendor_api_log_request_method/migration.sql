-- AlterTable
ALTER TABLE `vendor_api_log` ADD COLUMN `request_method` ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE') NOT NULL;
