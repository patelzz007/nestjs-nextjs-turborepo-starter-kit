// API contract leaves owned by the `feature-flags` context (enhancement 5.6). Composed into `apiContract`.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { singleResponse } from "../../contracts/response";
import { featureFlagsRoutes } from "./routes";
import { OkResponseSchema } from "../../schemas/api/message";
import {
	FeatureFlagListSchema,
	FeatureFlagSchema,
	FeatureFlagSettingsSchema,
	FeatureFlagStoreOptionListSchema,
	FeatureFlagStoreSearchQuerySchema,
	FeatureFlagStoreOverrideListSchema,
	FeatureFlagStoreOverrideSchema,
	RemoveFeatureFlagStoreOverrideInputSchema,
	SetFeatureFlagStoreOverrideInputSchema,
	StoreFeatureFlagPathSchema,
	UpdateFeatureFlagInputSchema,
} from "./schemas/feature-flags";

export const featureFlagsContract = {
	list: defineContract({ method: "GET", path: featureFlagsRoutes.list, input: z.undefined(), response: singleResponse(FeatureFlagListSchema) }),
	settings: defineContract({ method: "GET", path: featureFlagsRoutes.settings, input: z.undefined(), response: singleResponse(FeatureFlagSettingsSchema) }),
	update: defineContract({ method: "PUT", path: featureFlagsRoutes.flag, input: UpdateFeatureFlagInputSchema, response: singleResponse(FeatureFlagSchema) }),
	overrides: defineContract({
		method: "GET",
		path: featureFlagsRoutes.overrides,
		input: StoreFeatureFlagPathSchema,
		response: singleResponse(FeatureFlagStoreOverrideListSchema),
	}),
	stores: defineContract({
		method: "GET",
		path: featureFlagsRoutes.stores,
		input: FeatureFlagStoreSearchQuerySchema,
		response: singleResponse(FeatureFlagStoreOptionListSchema),
	}),
	setOverride: defineContract({
		method: "PUT",
		path: featureFlagsRoutes.overrides,
		input: SetFeatureFlagStoreOverrideInputSchema,
		response: singleResponse(FeatureFlagStoreOverrideSchema),
	}),
	removeOverride: defineContract({
		method: "POST",
		path: featureFlagsRoutes.removeOverride,
		input: RemoveFeatureFlagStoreOverrideInputSchema,
		response: singleResponse(OkResponseSchema),
	}),
};
