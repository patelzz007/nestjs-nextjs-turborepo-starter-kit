// API contract leaves owned by the `referrals` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { UuidParamSchema } from "../../schemas/domain/platform/param-schemas";
import { rewardReferralsRoutes, signupReferralsAuthRoutes } from "./routes";
import { RewardReferralAttributionResponseSchema, RewardReferralAttributionSchema, RewardReferralLinkResponseSchema } from "./schemas/reward-referrals";
import { SignupReferralDashboardSchema, SignupReferralRefereeItemSchema, SignupReferralRefereeListQuerySchema } from "./schemas/signup-referrals";

/** Contract leaves composed into `apiContract.auth` (signupReferralsDashboard, signupReferralsReferees). */
export const signupReferralsAuthContract = {
	signupReferralsDashboard: defineContract({
		method: "GET",
		path: signupReferralsAuthRoutes.signupReferralsDashboard,
		input: z.undefined(),
		response: singleResponse(SignupReferralDashboardSchema),
	}),
	signupReferralsReferees: defineContract({
		method: "GET",
		path: signupReferralsAuthRoutes.signupReferralsReferees,
		input: SignupReferralRefereeListQuerySchema,
		response: paginatedResponse(SignupReferralRefereeItemSchema),
	}),
};

/** Contract leaves composed into `apiContract.referrals`. */
export const rewardReferralsContract = {
	createLink: defineContract({
		method: "POST",
		path: rewardReferralsRoutes.createLink,
		input: z.object({ rewardId: UuidParamSchema }).strict(),
		response: singleResponse(RewardReferralLinkResponseSchema),
	}),
	recordAttribution: defineContract({
		method: "POST",
		path: rewardReferralsRoutes.recordAttribution,
		input: RewardReferralAttributionSchema,
		response: singleResponse(RewardReferralAttributionResponseSchema),
	}),
};
