import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, LIST_MAX_LIMIT } from "../../../schemas/api/list-query";
import { RewardBackupCodeSchema } from "../../claims/schemas/claim-enums";
import { LocationFilterSchema } from "../../tenancy/schemas/location-filter";
import { PosTerminalIdSchema } from "./redemption";

// ── POS terminals (`TenantTerminal`) and their pairing ──

/** How long a terminal pairing code stays usable (15 minutes). */
export const POS_PAIRING_CODE_TTL_MS = 15 * 60 * 1000;

/** One-time pairing code a till enters once: 8 characters, same unambiguous alphabet as backup codes. */
export const PosPairingCodeSchema = RewardBackupCodeSchema;

export type PosPairingCode = z.output<typeof PosPairingCodeSchema>;

/** Longest terminal display name (matches the `label` column). */
export const POS_TERMINAL_NAME_MAX_LENGTH = 100;

/**
 * A terminal's state, derived (never stored): `AWAITING_PAIRING` while a code
 * is live, `ACTIVE` once paired with a key that still works, `UNPAIRED`
 * otherwise (code expired, key revoked, or registered without pairing).
 */
export const PosTerminalStatusSchema = z.enum(["AWAITING_PAIRING", "ACTIVE", "UNPAIRED"]);

export type PosTerminalStatus = z.output<typeof PosTerminalStatusSchema>;

/**
 * `POST /tenants/:tenantSlug/terminals` — every till belongs to one store. `terminalId` is the
 * merchant's own till label (what the till sends as `X-Terminal-Id`); omit it to get a
 * generated `TERM-…` id. A label already used by a live terminal of the tenant is
 * refused (409 `TERMINAL_ID_TAKEN`); a removed terminal's label may be reused.
 */
export const MerchantCreateTerminalSchema = z
	.object({
		name: z.string().trim().min(1).max(POS_TERMINAL_NAME_MAX_LENGTH),
		locationId: z.uuid(),
		terminalId: PosTerminalIdSchema.optional(),
	})
	.strict();

export type MerchantCreateTerminalInput = z.output<typeof MerchantCreateTerminalSchema>;

/** `GET /tenants/:tenantSlug/terminals` — newest first; `locationId` is an authorization SCOPE. */
export const merchantTerminalListQuery = defineListQuery({
	sortable: ["createdAt", "name"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {},
	params: LocationFilterSchema.shape,
	defaultLimit: LIST_MAX_LIMIT,
});

export const MerchantTerminalListQuerySchema = merchantTerminalListQuery.schema;

export type MerchantTerminalListQuery = z.output<typeof MerchantTerminalListQuerySchema>;

export type MerchantTerminalListSortField = (typeof merchantTerminalListQuery.sortable)[number];

/** One page holds every till a merchant realistically has. */
export const MERCHANT_TERMINALS_PAGE_SIZE = LIST_MAX_LIMIT;

/** `GET` / `PATCH /tenants/:tenantSlug/terminals/settings` — tenant-wide POS policy. */
export const MerchantTerminalSettingsSchema = z
	.object({
		/** When on, POS calls with a manually created API key must come from a registered terminal id. */
		requireRegisteredTerminals: z.boolean(),
	})
	.strict();

export type MerchantTerminalSettings = z.output<typeof MerchantTerminalSettingsSchema>;

/** The same settings as the API RETURNS them — open, so additive fields never break a client (ADR 022). */
export const MerchantTerminalSettingsResponseSchema = z.object({ requireRegisteredTerminals: z.boolean() });

/** `POST /integration/terminals/pair` — the till's one call with the code shown in the merchant console. */
export const PosPairTerminalSchema = z.object({ pairingCode: PosPairingCodeSchema }).strict();

export type PosPairTerminalInput = z.output<typeof PosPairTerminalSchema>;

export const MerchantTerminalSummarySchema = BaseResponseSchema.extend({
	id: z.uuid(),
	/** What the till sends as `X-Terminal-Id` (the merchant's label, or generated, e.g. `TERM-7F3K9QX2`). */
	terminalId: PosTerminalIdSchema,
	name: z.string(),
	locationId: z.uuid(),
	locationName: z.string(),
	status: PosTerminalStatusSchema,
	/** While `AWAITING_PAIRING`: when the live code stops working. */
	pairingCodeExpiresAt: EpochMsSchema.nullable(),
	pairedAt: EpochMsSchema.nullable(),
	lastSeenAt: EpochMsSchema.nullable(),
});

export type MerchantTerminalSummary = z.output<typeof MerchantTerminalSummarySchema>;

/** `GET /tenants/:tenantSlug/terminals/summary` query — `locationId` narrows to one of the caller's stores (an authorization SCOPE). */
export const MerchantTerminalStatusSummaryQuerySchema = LocationFilterSchema;

export type MerchantTerminalStatusSummaryQuery = z.output<typeof MerchantTerminalStatusSummaryQuerySchema>;

/** Live terminals per derived status (see {@link PosTerminalStatusSchema}); every status is always present. */
export const MerchantTerminalStatusCountsSchema = z.object({
	AWAITING_PAIRING: z.number().int().nonnegative(),
	ACTIVE: z.number().int().nonnegative(),
	UNPAIRED: z.number().int().nonnegative(),
});

export type MerchantTerminalStatusCounts = z.output<typeof MerchantTerminalStatusCountsSchema>;

/**
 * `GET /tenants/:tenantSlug/terminals/summary` — the caller's live terminals at a glance, within its
 * store scope (a store-limited member never counts another store's tills).
 */
export const MerchantTerminalStatusSummarySchema = z.object({
	/** Live terminals in scope. Equals the sum of `byStatus`. */
	total: z.number().int().nonnegative(),
	byStatus: MerchantTerminalStatusCountsSchema,
	/** Stores in scope that have at least one live terminal. */
	storesWithTerminals: z.number().int().nonnegative(),
});

export type MerchantTerminalStatusSummary = z.output<typeof MerchantTerminalStatusSummarySchema>;

/** A terminal plus its one-time pairing code — the only time the code is ever returned. */
export const MerchantTerminalPairingSchema = z.object({
	terminal: MerchantTerminalSummarySchema,
	pairingCode: PosPairingCodeSchema,
	pairingCodeExpiresAt: EpochMsSchema,
});

export type MerchantTerminalPairing = z.output<typeof MerchantTerminalPairingSchema>;

/** What a till receives when it pairs: its own API key (shown once) and who it now belongs to. */
export const PosPairedTerminalSchema = z.object({
	apiKey: z.string(),
	terminalId: PosTerminalIdSchema,
	terminalName: z.string(),
	tenant: z.object({ id: z.uuid(), slug: z.string(), displayName: z.string() }),
	location: z.object({ id: z.uuid(), name: z.string() }),
});

export type PosPairedTerminal = z.output<typeof PosPairedTerminalSchema>;
