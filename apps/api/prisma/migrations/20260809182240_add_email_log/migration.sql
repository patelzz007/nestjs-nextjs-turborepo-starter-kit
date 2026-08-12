-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "to" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "status" TEXT NOT NULL,
    "resend_id" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_template_key_idx" ON "email_logs"("template_key");

-- CreateIndex
CREATE INDEX "email_logs_to_idx" ON "email_logs"("to");

-- CreateIndex
CREATE INDEX "email_logs_created_at_idx" ON "email_logs"("created_at");
