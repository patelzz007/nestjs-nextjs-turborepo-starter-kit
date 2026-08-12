-- Remove open/click tracking (pixel + engagement timestamps) from EmailLog.
ALTER TABLE email_logs DROP COLUMN IF EXISTS tracking_token;
ALTER TABLE email_logs DROP COLUMN IF EXISTS opened_at;
ALTER TABLE email_logs DROP COLUMN IF EXISTS clicked_at;
