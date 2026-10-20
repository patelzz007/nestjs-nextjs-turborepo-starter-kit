// API contract leaves owned by the `pos` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { OkResponseSchema } from "../../schemas/api/message";
import { UuidParamSchema } from "../../schemas/domain/platform/param-schemas";
import { MerchantApiKeyCreatedSchema, MerchantApiKeyListQuerySchema, MerchantApiKeySummarySchema, MerchantCreateApiKeySchema } from "./schemas/merchant-api-keys";
import {
	MerchantRedemptionListItemSchema,
	MerchantRedemptionListQuerySchema,
	RedemptionCheckoutResponseSchema,
	RedemptionCheckoutSchema,
	RedemptionPreviewResponseSchema,
	RedemptionValidateSchema,
} from "./schemas/redemption";
import {
	MerchantCreateTerminalSchema,
	MerchantTerminalListQuerySchema,
	MerchantTerminalPairingSchema,
	MerchantTerminalSettingsResponseSchema,
	MerchantTerminalSettingsSchema,
	MerchantTerminalStatusSummaryQuerySchema,
	MerchantTerminalStatusSummarySchema,
	MerchantTerminalSummarySchema,
	PosPairTerminalSchema,
	PosPairedTerminalSchema,
} from "./schemas/terminals";
import { TenantSlugParamSchema } from "../tenancy/schemas/tenant";
import { integrationRedemptionsRoutes, tenantApiKeysRoutes, tenantRedemptionsRoutes, tenantTerminalsRoutes } from "./routes";

/** Contract leaves composed into `apiContract.tenants` (redemptions). */
export const tenantRedemptionsContract = {
	redemptions: defineContract({
		method: "GET",
		path: tenantRedemptionsRoutes.redemptions,
		input: z.intersection(TenantSlugParamSchema, MerchantRedemptionListQuerySchema),
		response: paginatedResponse(MerchantRedemptionListItemSchema),
	}),
};

/**
 * Contract leaves composed into `apiContract.integration`: a till's pairing, validate and checkout
 * calls, and an integration API key's own redemption history (tenant and store from the key).
 */
export const integrationRedemptionsContract = {
	redemptions: defineContract({
		method: "GET",
		path: integrationRedemptionsRoutes.redemptions,
		input: MerchantRedemptionListQuerySchema,
		response: paginatedResponse(MerchantRedemptionListItemSchema),
	}),
	validateRedemption: defineContract({
		access: "public",
		method: "POST",
		path: integrationRedemptionsRoutes.validateRedemption,
		input: RedemptionValidateSchema,
		response: singleResponse(RedemptionPreviewResponseSchema),
	}),
	checkoutRedemption: defineContract({
		access: "public",
		method: "POST",
		path: integrationRedemptionsRoutes.checkoutRedemption,
		input: RedemptionCheckoutSchema,
		response: singleResponse(RedemptionCheckoutResponseSchema),
	}),
	pairTerminal: defineContract({
		access: "public",
		method: "POST",
		path: integrationRedemptionsRoutes.pairTerminal,
		input: PosPairTerminalSchema,
		response: singleResponse(PosPairedTerminalSchema),
	}),
};

/** Contract leaves composed into `apiContract.tenants.terminals`. */
export const tenantTerminalsContract = {
	list: defineContract({
		method: "GET",
		path: tenantTerminalsRoutes.list,
		input: z.intersection(TenantSlugParamSchema, MerchantTerminalListQuerySchema),
		response: paginatedResponse(MerchantTerminalSummarySchema),
	}),
	summary: defineContract({
		method: "GET",
		path: tenantTerminalsRoutes.summary,
		input: z.intersection(TenantSlugParamSchema, MerchantTerminalStatusSummaryQuerySchema),
		response: singleResponse(MerchantTerminalStatusSummarySchema),
	}),
	get: defineContract({
		method: "GET",
		path: tenantTerminalsRoutes.get,
		input: z.object({ tenantSlug: TenantSlugParamSchema.shape.tenantSlug, id: UuidParamSchema }).strict(),
		response: singleResponse(MerchantTerminalSummarySchema),
	}),
	create: defineContract({
		method: "POST",
		path: tenantTerminalsRoutes.create,
		input: z.intersection(TenantSlugParamSchema, MerchantCreateTerminalSchema),
		response: singleResponse(MerchantTerminalPairingSchema),
	}),
	pairingCode: defineContract({
		method: "POST",
		path: tenantTerminalsRoutes.pairingCode,
		input: z.object({ tenantSlug: TenantSlugParamSchema.shape.tenantSlug, id: UuidParamSchema }).strict(),
		response: singleResponse(MerchantTerminalPairingSchema),
	}),
	remove: defineContract({
		method: "DELETE",
		path: tenantTerminalsRoutes.remove,
		input: z.object({ tenantSlug: TenantSlugParamSchema.shape.tenantSlug, id: UuidParamSchema }).strict(),
		response: singleResponse(OkResponseSchema),
	}),
	settings: defineContract({
		method: "GET",
		path: tenantTerminalsRoutes.settings,
		input: TenantSlugParamSchema,
		response: singleResponse(MerchantTerminalSettingsResponseSchema),
	}),
	updateSettings: defineContract({
		method: "PATCH",
		path: tenantTerminalsRoutes.settings,
		input: z.intersection(TenantSlugParamSchema, MerchantTerminalSettingsSchema),
		response: singleResponse(MerchantTerminalSettingsResponseSchema),
	}),
};

/** Contract leaves composed into `apiContract.tenants.apiKeys`. */
export const tenantApiKeysContract = {
	list: defineContract({
		method: "GET",
		path: tenantApiKeysRoutes.list,
		input: z.intersection(TenantSlugParamSchema, MerchantApiKeyListQuerySchema),
		response: paginatedResponse(MerchantApiKeySummarySchema),
	}),
	create: defineContract({
		method: "POST",
		path: tenantApiKeysRoutes.create,
		input: z.intersection(TenantSlugParamSchema, MerchantCreateApiKeySchema),
		response: singleResponse(MerchantApiKeyCreatedSchema),
	}),
	revoke: defineContract({
		method: "POST",
		path: tenantApiKeysRoutes.revoke,
		input: z.object({ tenantSlug: TenantSlugParamSchema.shape.tenantSlug, keyId: UuidParamSchema }).strict(),
		response: singleResponse(OkResponseSchema),
	}),
};
