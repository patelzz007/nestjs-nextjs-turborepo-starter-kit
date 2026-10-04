import { z } from "zod";

/**
 * Domain error codes the merchant (organization) API answers with, so the
 * merchant portal can map each one onto the right UI state — never by
 * matching a bare string. Feature modules own their codes (docs/technical/api/errors.md);
 * these are the ones a client is expected to act on:
 *
 * - `ORGANIZATION_LOCATION_FORBIDDEN` (403) — the requested `locationId` is
 *   outside the member's store scope (e.g. a stale store choice).
 * - `API_KEY_LOCATION_REQUIRED` (403) — a store-limited member tried to create
 *   an organization-wide API key; they must choose one of their stores.
 * - `TERMINAL_ID_TAKEN` (409) — another live terminal of the organization
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
	"ORGANIZATION_LOCATION_FORBIDDEN",
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
