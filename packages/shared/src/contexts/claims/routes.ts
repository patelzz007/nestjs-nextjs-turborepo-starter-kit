// API path templates owned by the `claims` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.claims`. */
export const claimsRoutes = {
	otp: "/claims/otp",
	create: "/claims",
	list: "/claims",
	detail: "/claims/:claimId",
	qr: "/claims/:claimId/qr",
} satisfies Record<string, RouteTree>;
