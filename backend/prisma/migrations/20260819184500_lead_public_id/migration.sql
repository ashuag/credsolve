-- Public journey ID on lead (`lead_id`). Copied to application.application_number
-- and loan_account.loan_number so lead → application → loan share one unique ID.

ALTER TABLE `lead`
  ADD COLUMN `lead_id` VARCHAR(12) NULL;

-- Converted leads: reuse the earliest application's public number.
UPDATE `lead` l
INNER JOIN (
  SELECT a.lead_id AS lid, a.application_number
  FROM `application` a
  INNER JOIN (
    SELECT `lead_id`, MIN(`id`) AS min_id
    FROM `application`
    GROUP BY `lead_id`
  ) first_app ON first_app.min_id = a.id
) src ON src.lid = l.id
SET l.lead_id = src.application_number
WHERE l.lead_id IS NULL;

-- Remaining leads: stable unique value derived from id + uuid.
UPDATE `lead`
SET `lead_id` = CONCAT(
  'APP',
  YEAR(`created_at`),
  UPPER(SUBSTRING(MD5(CONCAT('lead:', `id`, ':', `uuid`)), 1, 5))
)
WHERE `lead_id` IS NULL;

-- Break remaining duplicate lead_id values (keep the lowest numeric id).
UPDATE `lead` l
INNER JOIN (
  SELECT `lead_id`, MIN(`id`) AS keep_id
  FROM `lead`
  WHERE `lead_id` IS NOT NULL
  GROUP BY `lead_id`
  HAVING COUNT(*) > 1
) d ON d.lead_id = l.lead_id AND l.id <> d.keep_id
SET l.lead_id = CONCAT(
  'APP',
  YEAR(l.created_at),
  UPPER(SUBSTRING(MD5(CONCAT('lead-retry:', l.id, ':', l.uuid)), 1, 5))
);

ALTER TABLE `lead`
  MODIFY COLUMN `lead_id` VARCHAR(12) NOT NULL,
  ADD UNIQUE INDEX `lead_lead_id_key`(`lead_id`);
