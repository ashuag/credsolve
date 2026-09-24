-- Missing indexes for the LOS "download dump" export filters (vendor logs, bureau report,
-- leads, loans, applications) — columns that are filtered by exact/range/`in` match (not a
-- `contains` substring search, which no B-tree index can help) but had no index at all.

-- bureau_report: CIBIL score range filter (bureau report + leads/applications dumps)
CREATE INDEX `bureau_report_cibil_score_idx` ON `bureau_report`(`cibil_score`);

-- cibil_credit_assessment: grade filter (bureau report + leads/loans/applications dumps)
CREATE INDEX `cibil_credit_assessment_category_idx` ON `cibil_credit_assessment`(`category`);

-- lead_detail: occupation filter join-back (leads dump)
CREATE INDEX `lead_detail_occupation_id_idx` ON `lead_detail`(`occupation_id`);

-- loan_account: repay-by date filter used standalone (loans dump) — the existing
-- (loan_status_id, closed_at, loan_maturity_date) composite only helps when status/closed
-- are also filtered.
CREATE INDEX `loan_account_loan_maturity_date_idx` ON `loan_account`(`loan_maturity_date`);

-- application_detail: exact loan-amount filter (applications dump); table had no index at all.
CREATE INDEX `application_detail_selected_loan_amount_idx` ON `application_detail`(`selected_loan_amount`);
