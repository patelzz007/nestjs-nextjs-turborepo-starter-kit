// API path templates owned by the `tiers` context (ADR 085). Composed into `apiRoutes.tiers`.

import type { RouteTree } from "../../route-tree";

export const tiersRoutes = {
	/** Whether tiers are on for this deployment (the `customer-tiers` flag), for any caller, signed in or not. */
	availability: "/tiers/availability",
	/** The signed-in customer's own tier page. */
	me: "/tiers/me",
	/** The tier rules in force (SYSTEM_SETTINGS:READ) and changing them (SYSTEM_SETTINGS:UPDATE). */
	adminSettings: "/admin/tiers/settings",
	/** How many customers stand at each tier (ANALYTICS:READ). */
	adminDistribution: "/admin/tiers/distribution",
	/** One customer's tier and tier history, on their user page (USER:READ). */
	adminUserTier: "/admin/users/:userId/tier",
} satisfies Record<string, RouteTree>;
