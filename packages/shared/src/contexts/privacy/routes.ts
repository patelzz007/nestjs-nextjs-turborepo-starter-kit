// API path templates owned by the `privacy` context (ADR 077). Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** The signed-in person's own data. */
export const privacyRoutes = {
	/** "Download my data": a ZIP of everything the platform holds about the person. */
	dataExport: "/me/data-export",
	/** "Delete my account": its status (GET) and asking for it (POST, with the password). */
	erasure: "/me/erasure",
	/** Changing your mind during the 30-day grace period. */
	cancelErasure: "/me/erasure/cancel",
} satisfies Record<string, RouteTree>;

/** Support erasing an account for someone who asked another way (ADR 077, Q13). */
export const adminPrivacyRoutes = {
	userErasure: "/admin/users/:userId/erasure",
	cancelUserErasure: "/admin/users/:userId/erasure/cancel",
} satisfies Record<string, RouteTree>;
