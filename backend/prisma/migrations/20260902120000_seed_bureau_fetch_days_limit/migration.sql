INSERT INTO `setting` (`key`, `value`, `description`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'BUREAU_FETCH_DAYS_LIMIT',
  '7',
  'For recurring customers (loan repaid/CLOSED): reuse the latest bureau_report for this customer if it is younger than this many days; otherwise fetch bureau again. 0 = always fetch.',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`);
