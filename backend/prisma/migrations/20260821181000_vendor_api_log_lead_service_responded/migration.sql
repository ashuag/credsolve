-- Latest vendor call for a lead+service (PAN NSDL on lead detail, internal-error
-- recovery, lead-report nested include). lead_id alone still used for other lookups.
CREATE INDEX `vendor_api_log_lead_id_service_name_responded_at_idx`
  ON `vendor_api_log`(`lead_id`, `service_name`, `responded_at`);
