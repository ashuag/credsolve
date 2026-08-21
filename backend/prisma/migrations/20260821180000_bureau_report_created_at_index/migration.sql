-- LOS Reports → Bureau Report lists the latest 500 rows by created_at.
-- Without this index MySQL filesorts the table and reads raw_payload JSON for every row.
CREATE INDEX `bureau_report_created_at_idx` ON `bureau_report`(`created_at`);
