import { z } from "zod";

/**
 * Shared Zod enum schemas that mirror Prisma's generated enums.
 *
 * These are used in place of `z.nativeEnum()` imports from `@prisma/client`
 * wherever Zod schemas are defined in `packages/shared/`. Since Prisma is
 * a backend-only dependency, the shared package cannot import Prisma enums
 * directly — so we define the same enum values as Zod string literal enums.
 *
 * Each export follows the pattern:
 *   - `FooSchema`  — the Zod enum validator
 *   - `Foo`        — the extracted TypeScript type
 */

// ── Permission Action ─────────────────────────────────────────────────────

export const PermissionActionSchema = z.enum(["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"]);
export type PermissionAction = z.output<typeof PermissionActionSchema>;

// ── Permission Resource ───────────────────────────────────────────────────

export const PermissionResourceSchema = z.enum([
	"USER",
	"PROFILE",
	"ROLE",
	"PERMISSION",
	"ADMIN_DASHBOARD",
	"SYSTEM_SETTINGS",
	"ANALYTICS",
	"AUDIT_LOG",
	"REPORT",
	"EMAIL",
	"GEO",
	"REWARD",
	"MERCHANT_ORG",
	"REDEMPTION",
	"SAMPLE_CATEGORY",
	"PRODUCT",
	"DEVTOOLS",
	"ORDER",
	"PAYMENT",
	"INVENTORY",
	"TENANT",
	"LOCATION",
	"GITHUB",
	"GITHUB_PULL_REQUEST",
]);
export type PermissionResource = z.output<typeof PermissionResourceSchema>;
