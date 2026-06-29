-- Singular table name (matches application_kyc, application_reference, etc.).
SET @rename_sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_details'
    ),
    'RENAME TABLE `application_details` TO `application_detail`',
    'SELECT 1'
  )
);
PREPARE _migrate_rename_application_detail FROM @rename_sql;
EXECUTE _migrate_rename_application_detail;
DEALLOCATE PREPARE _migrate_rename_application_detail;
