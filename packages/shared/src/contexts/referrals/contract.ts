// API contract leaves owned by the `referrals` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { signupReferralsAuthRoutes } from "./routes";
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
