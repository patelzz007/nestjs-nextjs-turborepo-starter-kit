-- AlterTable
ALTER TABLE "email_logs" ADD COLUMN     "tracking_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_tracking_token_key" ON "email_logs"("tracking_token");
