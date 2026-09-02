-- Pointer from lead_detail to the current bureau_report for this lead.

ALTER TABLE `lead_detail`
  ADD COLUMN `bureau_report_id` BIGINT UNSIGNED NULL AFTER `bureau_fetched_note`;

UPDATE `lead_detail` ld
INNER JOIN (
  SELECT b.lead_id, b.id
  FROM `bureau_report` b
  INNER JOIN (
    SELECT lead_id, MAX(id) AS max_id
    FROM `bureau_report`
    GROUP BY lead_id
  ) latest ON latest.max_id = b.id
) src ON src.lead_id = ld.lead_id
SET ld.bureau_report_id = src.id;

CREATE INDEX `lead_detail_bureau_report_id_idx` ON `lead_detail`(`bureau_report_id`);

ALTER TABLE `lead_detail`
  ADD CONSTRAINT `lead_detail_bureau_report_id_fkey`
  FOREIGN KEY (`bureau_report_id`) REFERENCES `bureau_report`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
