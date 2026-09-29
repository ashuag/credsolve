-- The Vendor API Logs "Method" filter is an exact match (GET/POST/PUT/PATCH/DELETE) with no
-- backing index. request_method is heavily skewed toward POST in practice, so this mainly speeds
-- up filtering by a less-common method (e.g. GET) — for POST itself the optimizer will still
-- correctly prefer a table scan over this index, since POST matches nearly all rows.
CREATE INDEX `vendor_api_log_request_method_requested_at_idx` ON `vendor_api_log`(`request_method`, `requested_at`);
