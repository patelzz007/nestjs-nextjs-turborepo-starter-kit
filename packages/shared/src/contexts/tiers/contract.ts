// API contract leaves owned by the `tiers` context (ADR 085). Composed into `apiContract.tiers`.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { singleResponse } from "../../contracts/response";
import { tiersRoutes } from "./routes";
import {
	AdminUserTierPathSchema,
	AdminUserTierSchema,
	MyTierSchema,
	TierAvailabilitySchema,
	TierDistributionSchema,
	TierSettingsResponseSchema,
	UpdateTierSettingsSchema,
} from "./schemas/customer-tier";

export const tiersContract = {
	availability: defineContract({
		method: "GET",
		path: tiersRoutes.availability,
		input: z.undefined(),
		response: singleResponse(TierAvailabilitySchema),
		access: "public",
	}),
	me: defineContract({ method: "GET", path: tiersRoutes.me, input: z.undefined(), response: singleResponse(MyTierSchema) }),
	settings: defineContract({ method: "GET", path: tiersRoutes.adminSettings, input: z.undefined(), response: singleResponse(TierSettingsResponseSchema) }),
	updateSettings: defineContract({ method: "PUT", path: tiersRoutes.adminSettings, input: UpdateTierSettingsSchema, response: singleResponse(TierSettingsResponseSchema) }),
	distribution: defineContract({ method: "GET", path: tiersRoutes.adminDistribution, input: z.undefined(), response: singleResponse(TierDistributionSchema) }),
	userTier: defineContract({ method: "GET", path: tiersRoutes.adminUserTier, input: AdminUserTierPathSchema, response: singleResponse(AdminUserTierSchema) }),
};
