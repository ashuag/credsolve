ALTER TABLE `bureau_report`
  ADD COLUMN `vendor_name` VARCHAR(80) NULL AFTER `dummy_fetched`;

UPDATE `bureau_report`
SET `vendor_name` = JSON_UNQUOTE(JSON_EXTRACT(`raw_payload`, '$.sourceVendor'))
WHERE `vendor_name` IS NULL
  AND JSON_EXTRACT(`raw_payload`, '$.sourceVendor') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`raw_payload`, '$.sourceVendor')) <> '';

UPDATE `bureau_report`
SET `vendor_name` = 'Tenacio'
WHERE `vendor_name` IS NULL;
