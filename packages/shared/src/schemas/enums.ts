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

export const PermissionResourceSchema = z.enum(["USER", "PROFILE", "ROLE", "PERMISSION", "ADMIN_DASHBOARD", "SYSTEM_SETTINGS", "URL", "TAG", "API_KEY", "ANALYTICS", "AUDIT_LOG", "REPORT"]);
export type PermissionResource = z.output<typeof PermissionResourceSchema>;

// ── Device Type ───────────────────────────────────────────────────────────

export const DeviceTypeSchema = z.enum(["DESKTOP", "MOBILE", "TABLET", "BOT", "UNKNOWN"]);
export type DeviceType = z.output<typeof DeviceTypeSchema>;

// ── Redirect Type ─────────────────────────────────────────────────────────

export const RedirectTypeSchema = z.enum(["PERMANENT", "TEMPORARY"]);
export type RedirectType = z.output<typeof RedirectTypeSchema>;

// ── Plan ──────────────────────────────────────────────────────────────────

export const PlanSchema = z.enum(["FREE", "PRO", "ENTERPRISE"]);
export type Plan = z.output<typeof PlanSchema>;

// ── Menu Match Type ───────────────────────────────────────────────────────

export const MenuMatchTypeSchema = z.enum(["ANY", "ALL"]);
export type MenuMatchType = z.output<typeof MenuMatchTypeSchema>;

// ── Audience Type (for admin/client auth audience feature) ────────────────

export const AudienceTypeSchema = z.enum(["web", "admin", "both"]);
export type AudienceType = z.output<typeof AudienceTypeSchema>;
