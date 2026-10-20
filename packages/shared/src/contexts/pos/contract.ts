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
import { OrganizationSlugParamSchema } from "../organizations/schemas/organization";
import { organizationApiKeysRoutes, organizationRedemptionsRoutes, organizationTerminalsRoutes, posRoutes, redemptionsRoutes } from "./routes";

/** Contract leaves composed into `apiContract.organizations` (redemptions). */
export const organizationRedemptionsContract = {
	redemptions: defineContract({
		method: "GET",
		path: organizationRedemptionsRoutes.redemptions,
		input: z.intersection(OrganizationSlugParamSchema, MerchantRedemptionListQuerySchema),
		response: paginatedResponse(MerchantRedemptionListItemSchema),
	}),
};

/** Contract leaves composed into `apiContract.pos`. */
export const posContract = {
	pairTerminal: defineContract({
		access: "public",
		method: "POST",
		path: posRoutes.pairTerminal,
		input: PosPairTerminalSchema,
		response: singleResponse(PosPairedTerminalSchema),
	}),
};

/** Contract leaves composed into `apiContract.redemptions`. */
export const redemptionsContract = {
	validate: defineContract({
		access: "public",
		method: "POST",
		path: redemptionsRoutes.validate,
		input: RedemptionValidateSchema,
		response: singleResponse(RedemptionPreviewResponseSchema),
	}),
	checkout: defineContract({
		access: "public",
		method: "POST",
		path: redemptionsRoutes.checkout,
		input: RedemptionCheckoutSchema,
		response: singleResponse(RedemptionCheckoutResponseSchema),
	}),
};

/** Contract leaves composed into `apiContract.organizations.terminals`. */
export const organizationTerminalsContract = {
	list: defineContract({
		method: "GET",
		path: organizationTerminalsRoutes.list,
		input: z.intersection(OrganizationSlugParamSchema, MerchantTerminalListQuerySchema),
		response: paginatedResponse(MerchantTerminalSummarySchema),
	}),
	summary: defineContract({
		method: "GET",
		path: organizationTerminalsRoutes.summary,
		input: z.intersection(OrganizationSlugParamSchema, MerchantTerminalStatusSummaryQuerySchema),
		response: singleResponse(MerchantTerminalStatusSummarySchema),
	}),
	get: defineContract({
		method: "GET",
		path: organizationTerminalsRoutes.get,
		input: z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, id: UuidParamSchema }).strict(),
		response: singleResponse(MerchantTerminalSummarySchema),
	}),
	create: defineContract({
		method: "POST",
		path: organizationTerminalsRoutes.create,
		input: z.intersection(OrganizationSlugParamSchema, MerchantCreateTerminalSchema),
		response: singleResponse(MerchantTerminalPairingSchema),
	}),
	pairingCode: defineContract({
		method: "POST",
		path: organizationTerminalsRoutes.pairingCode,
		input: z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, id: UuidParamSchema }).strict(),
		response: singleResponse(MerchantTerminalPairingSchema),
	}),
	remove: defineContract({
		method: "DELETE",
		path: organizationTerminalsRoutes.remove,
		input: z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, id: UuidParamSchema }).strict(),
		response: singleResponse(OkResponseSchema),
	}),
	settings: defineContract({
		method: "GET",
		path: organizationTerminalsRoutes.settings,
		input: OrganizationSlugParamSchema,
		response: singleResponse(MerchantTerminalSettingsResponseSchema),
	}),
	updateSettings: defineContract({
		method: "PATCH",
		path: organizationTerminalsRoutes.settings,
		input: z.intersection(OrganizationSlugParamSchema, MerchantTerminalSettingsSchema),
		response: singleResponse(MerchantTerminalSettingsResponseSchema),
	}),
};

/** Contract leaves composed into `apiContract.organizations.apiKeys`. */
export const organizationApiKeysContract = {
	list: defineContract({
		method: "GET",
		path: organizationApiKeysRoutes.list,
		input: z.intersection(OrganizationSlugParamSchema, MerchantApiKeyListQuerySchema),
		response: paginatedResponse(MerchantApiKeySummarySchema),
	}),
	create: defineContract({
		method: "POST",
		path: organizationApiKeysRoutes.create,
		input: z.intersection(OrganizationSlugParamSchema, MerchantCreateApiKeySchema),
		response: singleResponse(MerchantApiKeyCreatedSchema),
	}),
	revoke: defineContract({
		method: "POST",
		path: organizationApiKeysRoutes.revoke,
		input: z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, keyId: UuidParamSchema }).strict(),
		response: singleResponse(OkResponseSchema),
	}),
};
