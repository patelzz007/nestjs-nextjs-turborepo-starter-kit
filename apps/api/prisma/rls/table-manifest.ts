/**
 * RLS table manifest — re-exports from `manifest-index.ts` (single source of truth).
 *
 * When you add a tenant-owned table in Prisma:
 * 1. Add it to the correct profile in `manifest-index.ts`.
 * 2. Enable RLS + policies in `prisma/rls.sql` and/or `prisma/rls/NN-*.sql`.
 * 3. Run `pnpm db:migrate` and `pnpm db:check-rls-manifest`.
 */

export {
	RLS_BYPASS_ONLY_TABLES,
	RLS_MANIFEST_PROFILES,
	RLS_ORGANIZATION_LOCATION_TABLES,
	RLS_ORGANIZATION_TENANT_TABLES,
	RLS_OWNERSHIP_TABLES,
	RLS_RBAC_CATALOG_TABLES,
	type RlsManifestProfile,
} from "./manifest-index";
