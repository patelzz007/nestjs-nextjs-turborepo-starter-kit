-- AlterTable: exceptions gain the triage status column (improvement 6)
ALTER TABLE "telescope_exceptions" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'open';

-- CreateIndex
CREATE INDEX "telescope_exceptions_status_idx" ON "telescope_exceptions"("status");

-- CreateTable: telescope_jobs (improvement 1 — durable job history)
CREATE TABLE "telescope_jobs" (
    "id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "duration_ms" INTEGER,
    "payload_size" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "correlation_id" TEXT,
    "enqueued_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telescope_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telescope_jobs_created_at_idx" ON "telescope_jobs"("created_at");

-- CreateTable: telescope_alerts (improvement 1 — durable alert history + ack/snooze state)
CREATE TABLE "telescope_alerts" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER,
    "duration_ms" INTEGER NOT NULL,
    "reason" VARCHAR(20) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "snoozed_until" TIMESTAMP(3),
    "fired_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telescope_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telescope_alerts_created_at_idx" ON "telescope_alerts"("created_at");

-- CreateTable: telescope_annotations (improvement 1 — durable star/comment state)
CREATE TABLE "telescope_annotations" (
    "request_id" TEXT NOT NULL,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telescope_annotations_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE INDEX "telescope_annotations_created_at_idx" ON "telescope_annotations"("created_at");
