/**
 * RLS table manifest — re-exports from `manifest-index.ts` (single source of truth).
 *
 * When you add a tenant-owned table in Prisma:
 * 1. Add it to the correct profile in `manifest-index.ts`.
 * 2. Enable RLS + policies in `prisma/rls.sql` and/or `prisma/rls/NN-*.sql`.
 * 3. Run `pnpm db:migrate` and `pnpm db:check-rls-manifest`.
 */

// The per-profile `RLS_*_TABLES` aliases are deprecated in manifest-index.ts;
// read `RLS_MANIFEST_PROFILES.<profile>` instead.
export { RLS_MANIFEST_PROFILES, type RlsManifestProfile } from "./manifest-index";
