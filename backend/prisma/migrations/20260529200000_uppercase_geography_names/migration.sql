-- Normalize geography master names to uppercase for consistent lookups.
UPDATE `state` SET `name` = UPPER(`name`);
UPDATE `city` SET `name` = UPPER(`name`);
