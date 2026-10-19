// API path templates owned by the `referrals` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.auth` (signupReferralsDashboard, signupReferralsReferees). */
export const signupReferralsAuthRoutes = {
	signupReferralsDashboard: "/auth/signup-referrals/dashboard",
	signupReferralsReferees: "/auth/signup-referrals/referees",
} satisfies Record<string, RouteTree>;
