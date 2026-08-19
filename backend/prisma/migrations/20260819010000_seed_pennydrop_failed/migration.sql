-- Terminal penny-drop outcome (Tenacio 400 Invalid Input or retry limit reached).
INSERT INTO `application_status` (`name`, `display_name`, `is_active`)
VALUES ('PENNYDROP_FAILED', 'Penny drop failed', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1, `display_name` = VALUES(`display_name`);

INSERT INTO `rejection_reason` (`name`, `is_active`)
VALUES ('PENNYDROP_FAILED', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;

-- Existing applications that already exhausted penny-drop (or last vendor result is Tenacio 400 Invalid Input).
UPDATE `application` a
JOIN `application_status` from_st ON from_st.id = a.application_status_id
JOIN `application_status` to_st ON to_st.name = 'PENNYDROP_FAILED' AND to_st.is_active = 1
JOIN `application_detail` d ON d.application_id = a.id
LEFT JOIN (
  SELECT CAST(`value` AS UNSIGNED) AS retry_count
  FROM `setting`
  WHERE `key` = 'PENNY_DROP_RETRY_COUNT' AND `is_active` = 1
  LIMIT 1
) s ON 1 = 1
LEFT JOIN `rejection_reason` rr ON rr.name = 'PENNYDROP_FAILED' AND rr.is_active = 1
SET
  a.application_status_id = to_st.id,
  a.rejection_reason_id = COALESCE(rr.id, a.rejection_reason_id)
WHERE from_st.name IN ('DRAFT', 'IN_REVIEW')
  AND (d.bank_account_number IS NULL OR TRIM(d.bank_account_number) = '')
  AND (
    d.penny_drop_attempts >= COALESCE(NULLIF(s.retry_count, 0), 2)
    OR CAST(JSON_UNQUOTE(JSON_EXTRACT(d.penny_drop_vendor_json, '$.serviceStatusCode')) AS UNSIGNED) = 400
    OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.penny_drop_vendor_json, '$.serviceError.message')), '')) LIKE '%invalid input%'
  );

UPDATE `lead` l
JOIN `application` a ON a.lead_id = l.id
JOIN `application_status` ast ON ast.id = a.application_status_id AND ast.name = 'PENNYDROP_FAILED'
JOIN `lead_status` from_ls ON from_ls.id = l.lead_status_id
JOIN `lead_status` rej ON rej.name = 'REJECTED' AND rej.is_active = 1
LEFT JOIN `rejection_reason` rr ON rr.name = 'PENNYDROP_FAILED' AND rr.is_active = 1
SET
  l.lead_status_id = rej.id,
  l.lead_status_note = 'Bank detail failed',
  l.rejection_reason_id = COALESCE(rr.id, l.rejection_reason_id)
WHERE from_ls.name NOT IN ('REJECTED', 'BLACKLISTED')
  AND l.is_active = 1;
