-- Split REJECTED_CREDIT_ASSESSMENT_GRADES into new vs recurring customer lists.
-- Preserve the existing value on the new-customer row, then copy it to recurring.
UPDATE `eligibility_criteria`
SET
  `key` = 'REJECTED_CREDIT_ASSESSMENT_GRADES_NEW',
  `label` = 'Rejected credit assessment grades (new customers)',
  `description` = 'Comma-separated list of CIBIL credit-assessment grades (A–H) that fail post-BRE for new customers',
  `updated_at` = NOW()
WHERE `key` = 'REJECTED_CREDIT_ASSESSMENT_GRADES';

INSERT INTO `eligibility_criteria` (`key`, `label`, `value`, `bre_type`, `description`, `is_active`, `created_at`, `updated_at`)
SELECT
  'REJECTED_CREDIT_ASSESSMENT_GRADES_EXISTING',
  'Rejected credit assessment grades (recurring customers)',
  src.`value`,
  'POST_BRE',
  'Comma-separated list of CIBIL credit-assessment grades (A–H) that fail post-BRE for recurring customers',
  src.`is_active`,
  NOW(),
  NOW()
FROM `eligibility_criteria` AS src
WHERE src.`key` = 'REJECTED_CREDIT_ASSESSMENT_GRADES_NEW'
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);
