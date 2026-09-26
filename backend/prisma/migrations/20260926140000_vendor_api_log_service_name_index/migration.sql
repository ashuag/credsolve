-- The Vendor API Logs "Service" filter switched from a `contains` substring search to an exact
-- match (it's a small fixed set of vendor service names, now offered as a dropdown, not free
-- text) — add the matching index so it can actually be used. `serviceName` previously only
-- existed as the middle column of (lead_id, service_name, responded_at), which the query
-- optimizer can't use for a service-only filter (leftmost-prefix rule).
CREATE INDEX `vendor_api_log_service_name_requested_at_idx` ON `vendor_api_log`(`service_name`, `requested_at`);
