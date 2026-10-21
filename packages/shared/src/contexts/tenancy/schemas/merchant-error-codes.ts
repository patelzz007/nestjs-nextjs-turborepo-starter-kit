import { z } from "zod";

/**
 * Domain error codes the merchant (tenant) API answers with, so the
 * merchant portal can map each one onto the right UI state — never by
 * matching a bare string. Feature modules own their codes (docs/technical/api/errors.md);
 * these are the ones a client is expected to act on:
 *
 * - `TENANT_LOCATION_FORBIDDEN` (403) — the requested `locationId` is
 *   outside the member's store scope (e.g. a stale store choice).
 * - `TENANT_SUSPENDED` (403) — the tenant is suspended, and this is not a lifecycle route.
 * - `TENANT_BANNED` (403) — the platform banned the tenant, and this is not a lifecycle route.
 * - `MEMBERSHIP_INACTIVE` (403) — the caller's membership is suspended or pending.
 * - `TENANT_APPEAL_PENDING` (409) — the suspended tenant already has an appeal waiting for review.
 * - `TENANT_OWNER_REQUIRED` (403) — only the owner may reactivate the tenant.
 * - `TENANT_OWNER_CANNOT_LEAVE` (409) — the owner cannot leave their tenant.
 * - `TENANT_DELETION_GRACE_OVER` (409) — the deletion grace period ended; the tenant cannot be reactivated.
 * - `API_KEY_LOCATION_REQUIRED` (403) — a store-limited member tried to create
 *   a tenant-wide API key; they must choose one of their stores.
 * - `TERMINAL_ID_TAKEN` (409) — another live terminal of the tenant
 *   already uses the requested terminal id.
 * - `MERCHANT_INVITE_NOT_FOUND` (404) — the onboarding link is not a valid invite.
 * - `MERCHANT_INVITE_EXPIRED` (410) — the onboarding invite has expired.
 * - `MERCHANT_INVITE_UNAVAILABLE` (409) — the invite was already used (the
 *   application was submitted) — e.g. a repeated `complete`.
 * - `MERCHANT_ONBOARDING_DOCUMENTS_CLOSED` (410) — the onboarding link can no
 *   longer take documents (window over, or already submitted); documents go
 *   through the signed-in verification page instead.
 */
export const MerchantErrorCodeSchema = z.enum([
	"TENANT_LOCATION_FORBIDDEN",
	"TENANT_SUSPENDED",
	"TENANT_BANNED",
	"MEMBERSHIP_INACTIVE",
	"TENANT_APPEAL_PENDING",
	"TENANT_OWNER_REQUIRED",
	"TENANT_OWNER_CANNOT_LEAVE",
	"TENANT_DELETION_GRACE_OVER",
	"API_KEY_LOCATION_REQUIRED",
	"TERMINAL_ID_TAKEN",
	"MERCHANT_INVITE_NOT_FOUND",
	"MERCHANT_INVITE_EXPIRED",
	"MERCHANT_INVITE_UNAVAILABLE",
	"MERCHANT_ONBOARDING_DOCUMENTS_CLOSED",
]);

export type MerchantErrorCode = z.output<typeof MerchantErrorCodeSchema>;

/** Enum-style accessor (`MerchantErrorCodes.TERMINAL_ID_TAKEN`) so call sites never repeat a bare string. */
export const MerchantErrorCodes = MerchantErrorCodeSchema.enum;

/** The tenant-access codes every app shows its own message for (web and merchant, MT-23). */
export const TenantAccessErrorCodeSchema = MerchantErrorCodeSchema.extract([
	"TENANT_SUSPENDED",
	"TENANT_BANNED",
	"MEMBERSHIP_INACTIVE",
	"TENANT_APPEAL_PENDING",
	"TENANT_OWNER_REQUIRED",
	"TENANT_OWNER_CANNOT_LEAVE",
	"TENANT_DELETION_GRACE_OVER",
]);

export type TenantAccessErrorCode = z.output<typeof TenantAccessErrorCodeSchema>;
