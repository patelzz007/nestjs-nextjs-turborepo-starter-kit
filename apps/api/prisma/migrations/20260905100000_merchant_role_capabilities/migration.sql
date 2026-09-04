-- Merchant portal role → capability grants (DB source of truth for merchant RBAC).

CREATE TABLE "merchant_role_capabilities" (
    "id" TEXT NOT NULL,
    "role" "MerchantMemberRole" NOT NULL,
    "capability" VARCHAR(100) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "merchant_role_capabilities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "merchant_role_capabilities_role_capability_key" ON "merchant_role_capabilities"("role", "capability");
CREATE INDEX "merchant_role_capabilities_role_idx" ON "merchant_role_capabilities"("role");
