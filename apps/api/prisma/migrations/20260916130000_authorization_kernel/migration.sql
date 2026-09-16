-- CreateEnum for Authorization Kernel
CREATE TYPE "PermissionScope" AS ENUM ('GLOBAL', 'ORGANIZATION', 'LOCATION', 'RESOURCE', 'OWN');
CREATE TYPE "AclEffect" AS ENUM ('ALLOW', 'DENY');
CREATE TYPE "PolicyEffect" AS ENUM ('ALLOW', 'DENY');
CREATE TYPE "AuthorizationDecision" AS ENUM ('ALLOW', 'DENY');

-- AlterEnum: Add new values to PermissionResource
ALTER TYPE "PermissionResource" ADD VALUE 'ORDER';
ALTER TYPE "PermissionResource" ADD VALUE 'PAYMENT';
ALTER TYPE "PermissionResource" ADD VALUE 'INVENTORY';
ALTER TYPE "PermissionResource" ADD VALUE 'ORGANIZATION';
ALTER TYPE "PermissionResource" ADD VALUE 'LOCATION';

-- AlterTable: Add scope to permissions
ALTER TABLE "permissions" ADD COLUMN "scope" "PermissionScope" NOT NULL DEFAULT 'GLOBAL';

-- DropIndex: Drop old unique constraint
ALTER TABLE "permissions" DROP CONSTRAINT "permissions_action_resource_key";

-- CreateIndex: Add new unique constraint with scope
CREATE UNIQUE INDEX "permissions_action_resource_scope_key" ON "permissions"("action", "resource", "scope");

-- CreateTable: ResourceAcl
CREATE TABLE "resource_acls" (
    "id" TEXT NOT NULL,
    "subject_type" VARCHAR(50) NOT NULL,
    "subject_id" TEXT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" TEXT,
    "effect" "AclEffect" NOT NULL,
    "scope" "PermissionScope",
    "organization_id" TEXT,
    "location_id" TEXT,
    "conditions" JSONB,
    "expires_at" BIGINT,
    "assigned_by" TEXT,
    "reason" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "resource_acls_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PolicyDefinition
CREATE TABLE "policy_definitions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effect" "PolicyEffect" NOT NULL,
    "scope" "PermissionScope" NOT NULL,
    "actions" TEXT[],
    "resources" TEXT[],
    "organization_id" TEXT,
    "location_id" TEXT,
    "conditions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "published_at" BIGINT,
    "published_by" TEXT,
    "superseded_by" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "policy_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuthorizationAudit
CREATE TABLE "authorization_audits" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "organization_id" TEXT,
    "location_id" TEXT,
    "action" VARCHAR(120) NOT NULL,
    "resource" VARCHAR(120) NOT NULL,
    "resource_id" TEXT,
    "decision" "AuthorizationDecision" NOT NULL,
    "reason" TEXT,
    "policy_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acl_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evaluation" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "request_id" VARCHAR(64),
    "duration_ms" INTEGER,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "authorization_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resource_acls_subject_type_subject_id_idx" ON "resource_acls"("subject_type", "subject_id");
CREATE INDEX "resource_acls_resource_type_resource_id_idx" ON "resource_acls"("resource_type", "resource_id");
CREATE INDEX "resource_acls_organization_id_idx" ON "resource_acls"("organization_id");
CREATE INDEX "resource_acls_location_id_idx" ON "resource_acls"("location_id");

CREATE INDEX "policy_definitions_organization_id_idx" ON "policy_definitions"("organization_id");
CREATE INDEX "policy_definitions_location_id_idx" ON "policy_definitions"("location_id");
CREATE INDEX "policy_definitions_is_active_idx" ON "policy_definitions"("is_active");

CREATE INDEX "authorization_audits_actor_id_idx" ON "authorization_audits"("actor_id");
CREATE INDEX "authorization_audits_organization_id_idx" ON "authorization_audits"("organization_id");
CREATE INDEX "authorization_audits_location_id_idx" ON "authorization_audits"("location_id");
CREATE INDEX "authorization_audits_decision_idx" ON "authorization_audits"("decision");
CREATE INDEX "authorization_audits_action_idx" ON "authorization_audits"("action");
CREATE INDEX "authorization_audits_created_at_idx" ON "authorization_audits"("created_at");

-- RLS for new Authorization Kernel tables
ALTER TABLE public.resource_acls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_acls FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_acls_read ON public.resource_acls;
CREATE POLICY resource_acls_read ON public.resource_acls
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS resource_acls_write ON public.resource_acls;
CREATE POLICY resource_acls_write ON public.resource_acls
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

ALTER TABLE public.policy_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_definitions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_definitions_read ON public.policy_definitions;
CREATE POLICY policy_definitions_read ON public.policy_definitions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS policy_definitions_write ON public.policy_definitions;
CREATE POLICY policy_definitions_write ON public.policy_definitions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

ALTER TABLE public.authorization_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_audits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authorization_audits_bypass ON public.authorization_audits;
CREATE POLICY authorization_audits_bypass ON public.authorization_audits
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());
