-- AlterTable: telescope_alerts — job alerts (failed jobs) may have no
-- correlated request, so request_id becomes nullable and a job_name column
-- records which job failed.
ALTER TABLE "telescope_alerts"
    ALTER COLUMN "request_id" DROP NOT NULL,
    ADD COLUMN "job_name" TEXT;
