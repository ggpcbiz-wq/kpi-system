CREATE TABLE IF NOT EXISTS section_submission_locks (
  section_id uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  report_year integer NOT NULL CHECK (report_year BETWEEN 2000 AND 2100),
  report_month integer NOT NULL CHECK (report_month BETWEEN 1 AND 12),
  locked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  locked_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (section_id, report_year, report_month)
);
