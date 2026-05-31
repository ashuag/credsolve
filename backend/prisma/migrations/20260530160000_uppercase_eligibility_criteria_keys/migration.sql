-- Uppercase all existing eligibility_criteria keys.
-- The key column has a unique index; since UPPER() is idempotent for already-uppercase
-- rows and a straight UPPER() produces the correct result for every lowercase key
-- (underscores are preserved, letters are uppercased), a single UPDATE suffices.
UPDATE `eligibility_criteria` SET `key` = UPPER(`key`);
