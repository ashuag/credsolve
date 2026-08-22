INSERT INTO `setting` (`key`, `value`, `description`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'REPAY_COOLING_PERIOD',
  '7',
  'Inclusive days from disbursement during which early repayment charges interest only for days used; after this, full contracted tenure interest applies',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`);
