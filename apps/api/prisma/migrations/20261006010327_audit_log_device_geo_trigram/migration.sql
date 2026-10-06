-- CreateEnum
CREATE TYPE "IpAddressScope" AS ENUM ('PUBLIC', 'PRIVATE', 'LOOPBACK', 'LINK_LOCAL', 'SHARED', 'DOCUMENTATION', 'MULTICAST', 'RESERVED');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "browser_name" VARCHAR(64),
ADD COLUMN     "browser_version" VARCHAR(32),
ADD COLUMN     "device_model" VARCHAR(64),
ADD COLUMN     "device_type" "DeviceType",
ADD COLUMN     "geo_city" VARCHAR(128),
ADD COLUMN     "geo_country" VARCHAR(2),
ADD COLUMN     "geo_region" VARCHAR(64),
ADD COLUMN     "geo_time_zone" VARCHAR(64),
ADD COLUMN     "ip_scope" "IpAddressScope",
ADD COLUMN     "ip_version" SMALLINT,
ADD COLUMN     "os_name" VARCHAR(64),
ADD COLUMN     "os_version" VARCHAR(32);

-- CreateIndex
CREATE INDEX "audit_logs_device_type_occurred_at_idx" ON "audit_logs"("device_type", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_path_trgm_idx" ON "audit_logs" USING GIN ("path" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "audit_logs_endpoint_trgm_idx" ON "audit_logs" USING GIN ("endpoint" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "audit_logs_error_code_trgm_idx" ON "audit_logs" USING GIN ("error_code" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "audit_logs_ip_address_trgm_idx" ON "audit_logs" USING GIN ("ip_address" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "audit_logs_user_agent_trgm_idx" ON "audit_logs" USING GIN ("user_agent" gin_trgm_ops);
