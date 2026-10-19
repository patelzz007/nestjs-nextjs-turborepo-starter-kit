import { z } from "zod";

/** Identity enums that mirror Prisma's generated enums (`DeviceType` on `RefreshToken`) plus the auth audience. */

// ── Device Type ───────────────────────────────────────────────────────────

export const DeviceTypeSchema = z.enum(["DESKTOP", "MOBILE", "TABLET", "BOT", "UNKNOWN"]);
export type DeviceType = z.output<typeof DeviceTypeSchema>;

// ── Audience Type (for admin/client auth audience feature) ────────────────

export const AudienceTypeSchema = z.enum(["web", "admin", "both"]);
export type AudienceType = z.output<typeof AudienceTypeSchema>;
