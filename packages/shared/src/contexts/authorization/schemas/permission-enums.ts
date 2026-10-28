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

/** CRUD plus the closed lifecycle verbs of ADR 067. There is no catch-all action: a route names the verb it performs. */
export const PermissionActionSchema = z.enum([
	"CREATE",
	"READ",
	"UPDATE",
	"DELETE",
	"LIST",
	"PUBLISH",
	"APPROVE",
	"REJECT",
	"SUSPEND",
	"BAN",
	"UNBAN",
	"REACTIVATE",
	"UNLOCK",
	"REDEEM",
]);
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
	"KANBAN_TASK",
	"KANBAN_BOARD",
	"SERVER_METRIC",
	"DATABASE_BACKUP",
	"LOAD_TEST",
	"MEMBER",
	"KYB",
	"ACCESS_REQUEST",
	"SUPPORT_ACCESS",
	"API_KEY",
	"INVITE",
	"SESSION",
	"CUSTOMER_BAN",
	"SHARE",
	"CLAIM",
	"TERMINAL",
]);
export type PermissionResource = z.output<typeof PermissionResourceSchema>;

// ── Roles and shares (ADR 067) ────────────────────────────────────────────

/** Where a role applies: the platform, a tenant-role template, or one tenant's own copy. */
export const RoleKindSchema = z.enum(["PLATFORM", "TEMPLATE", "TENANT"]);
export type RoleKind = z.output<typeof RoleKindSchema>;

/** What a per-record share gives: VIEW (read) or EDIT (read + update). */
export const ShareLevelSchema = z.enum(["VIEW", "EDIT"]);
export type ShareLevel = z.output<typeof ShareLevelSchema>;
