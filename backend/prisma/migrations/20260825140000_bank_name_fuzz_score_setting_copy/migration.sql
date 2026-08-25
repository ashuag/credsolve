-- Clarify bank-name fuzzing score setting: allowed range is 0–100%.
UPDATE `setting`
SET
  `description` = 'Max fuzzing score (0–100%) required to auto-pass bank account name vs customer name. Below this the application stays In Review at Bank details until credit approves.',
  `updated_at` = NOW()
WHERE `key` = 'PENNY_DROP_NAME_MATCH_MIN_SCORE';
