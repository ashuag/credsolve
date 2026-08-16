-- Post-BRE: reject when applicant mobile does not match any phone on the CIBIL report.
INSERT INTO `rejection_reason` (`name`, `is_active`)
VALUES ('BUREAU_PHONE_MISMATCH', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;
