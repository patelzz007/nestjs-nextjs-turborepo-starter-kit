import { z } from "zod";

/** Audit enums that mirror Prisma's generated enums (`IpAddressScope` on `AuditLog`). */

// ── IP Address Scope ──────────────────────────────────────────────────────

/** Address class of a client IP (mirrors the Prisma enum `IpAddressScope`). */
export const IpAddressScopeSchema = z.enum(["PUBLIC", "PRIVATE", "LOOPBACK", "LINK_LOCAL", "SHARED", "DOCUMENTATION", "MULTICAST", "RESERVED"]);
export type IpAddressScope = z.output<typeof IpAddressScopeSchema>;
