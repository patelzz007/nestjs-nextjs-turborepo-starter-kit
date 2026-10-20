import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, LIST_MAX_LIMIT, listFilter } from "../../../schemas/api/list-query";
import { LocationFilterSchema } from "../../tenancy/schemas/location-filter";

// ── Merchant API keys (till / integration credentials, `TenantApiKey`) ──

/** Longest POS API key (terminal) name — shared by the create form and the API. */
export const MERCHANT_API_KEY_NAME_MAX_LENGTH = 100;

/**
 * What a merchant API key may call (mirrors the Prisma `TenantApiKeyScope` enum):
 * - `POS` — a till: only the POS redemption routes (`/redemptions/*`). Every key a
 *   terminal receives by pairing is a POS key.
 * - `INTEGRATION` — a back-office integration: the POS routes plus the tenant
 *   reward / redemption-history / analytics API.
 */
export const TenantApiKeyScopeSchema = z.enum(["POS", "INTEGRATION"]);

export type TenantApiKeyScope = z.output<typeof TenantApiKeyScopeSchema>;

/** The scope a manually created key gets when none is chosen — least privilege. */
export const DEFAULT_MERCHANT_API_KEY_SCOPE: TenantApiKeyScope = "POS";

/**
 * `POST /tenants/:tenantSlug/api-keys`. `locationId` limits the key to one store; a member
 * limited to some stores must choose one of them (only an all-stores member may create
 * a tenant-wide key).
 */
export const MerchantCreateApiKeySchema = z
	.object({
		name: z.string().trim().min(1).max(MERCHANT_API_KEY_NAME_MAX_LENGTH).optional(),
		locationId: z.uuid().optional(),
		scope: TenantApiKeyScopeSchema.optional().default(DEFAULT_MERCHANT_API_KEY_SCOPE),
	})
	.strict();

/**
 * `GET /tenants/:tenantSlug/api-keys` list query — newest first, `filter[revokedAt][isNull]=true`
 * lists active keys. `locationId` is an authorization SCOPE (checked against the member's stores).
 * Pages are as large as the grammar allows: a tenant has a handful of terminal keys.
 */
/** One page holds every key a store realistically has; the merchant page says so when there are more. */
export const MERCHANT_API_KEYS_PAGE_SIZE = LIST_MAX_LIMIT;

export const merchantApiKeyListQuery = defineListQuery({
	sortable: ["createdAt", "name"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		revokedAt: listFilter.epochMs({ isNull: true }),
	},
	params: LocationFilterSchema.shape,
	defaultLimit: MERCHANT_API_KEYS_PAGE_SIZE,
});

export const MerchantApiKeyListQuerySchema = merchantApiKeyListQuery.schema;

export type MerchantApiKeyListQuery = z.output<typeof MerchantApiKeyListQuerySchema>;

export type MerchantApiKeyListSortField = (typeof merchantApiKeyListQuery.sortable)[number];

export type MerchantCreateApiKeyInput = z.output<typeof MerchantCreateApiKeySchema>;

export const MerchantApiKeySummarySchema = BaseResponseSchema.extend({
	id: z.uuid(),
	name: z.string(),
	locationId: z.uuid().nullable(),
	locationName: z.string().nullable(),
	scope: TenantApiKeyScopeSchema,
	revokedAt: EpochMsSchema.nullable(),
});

export type MerchantApiKeySummary = z.output<typeof MerchantApiKeySummarySchema>;

export const MerchantApiKeyCreatedSchema = z.object({
	id: z.uuid(),
	apiKey: z.string(),
	name: z.string(),
	scope: TenantApiKeyScopeSchema,
	locationId: z.uuid().nullable(),
});

export type MerchantApiKeyCreated = z.output<typeof MerchantApiKeyCreatedSchema>;
