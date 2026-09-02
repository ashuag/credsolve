-- Bureau reports belong to a customer. Leads point at the current snapshot via
-- `lead_detail.bureau_report_id` so reuse does not clone a row.

ALTER TABLE `bureau_report` DROP FOREIGN KEY `bureau_report_lead_id_fkey`;

DROP INDEX `bureau_report_lead_id_created_at_idx` ON `bureau_report`;

ALTER TABLE `bureau_report` DROP COLUMN `lead_id`;
