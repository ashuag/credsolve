-- Pre-NSDL: reject when PAN is already linked to a different phone number.
INSERT INTO `rejection_reason` (`name`, `is_active`)
VALUES ('PAN_ALREADY_LINKED_TO_PHONE', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;
