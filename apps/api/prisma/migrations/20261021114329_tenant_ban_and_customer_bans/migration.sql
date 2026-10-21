-- AlterEnum
ALTER TYPE "TenantLifecycleState" ADD VALUE 'BANNED';

-- CreateTable
CREATE TABLE "TenantCustomerBan" (
    "id" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "createdBy" VARCHAR(128),
    "updatedAt" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updatedBy" VARCHAR(128),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" BIGINT,
    "deletedBy" VARCHAR(128),
    "tenantId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "sourceRedemptionId" TEXT,
    "reason" TEXT NOT NULL,
    "bannedByUserId" TEXT,
    "bannedAt" BIGINT NOT NULL,
    "liftedByUserId" TEXT,
    "liftedAt" BIGINT,

    CONSTRAINT "TenantCustomerBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantCustomerBan_tenantId_bannedAt_idx" ON "TenantCustomerBan"("tenantId", "bannedAt");

-- CreateIndex
CREATE INDEX "TenantCustomerBan_customerUserId_idx" ON "TenantCustomerBan"("customerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCustomerBan_tenantId_customerUserId_key" ON "TenantCustomerBan"("tenantId", "customerUserId") WHERE ("liftedAt" IS NULL AND "isDeleted" = false);

-- AddForeignKey
ALTER TABLE "TenantCustomerBan" ADD CONSTRAINT "TenantCustomerBan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCustomerBan" ADD CONSTRAINT "TenantCustomerBan_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCustomerBan" ADD CONSTRAINT "TenantCustomerBan_sourceRedemptionId_fkey" FOREIGN KEY ("sourceRedemptionId") REFERENCES "RewardRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCustomerBan" ADD CONSTRAINT "TenantCustomerBan_bannedByUserId_fkey" FOREIGN KEY ("bannedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCustomerBan" ADD CONSTRAINT "TenantCustomerBan_liftedByUserId_fkey" FOREIGN KEY ("liftedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
