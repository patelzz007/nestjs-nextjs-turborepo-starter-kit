// API path templates owned by the `pos` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.organizations` (redemptions). */
export const organizationRedemptionsRoutes = {
	redemptions: "/orgs/:orgSlug/redemptions",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.pos`. */
export const posRoutes = {
	pairTerminal: "/pos/terminals/pair",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.redemptions`. */
export const redemptionsRoutes = {
	validate: "/redemptions/validate",
	checkout: "/redemptions/checkout",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.organizations.terminals`. */
export const organizationTerminalsRoutes = {
	list: "/orgs/:orgSlug/terminals",
	create: "/orgs/:orgSlug/terminals",
	summary: "/orgs/:orgSlug/terminals/summary",
	get: "/orgs/:orgSlug/terminals/:id",
	pairingCode: "/orgs/:orgSlug/terminals/:id/pairing-code",
	remove: "/orgs/:orgSlug/terminals/:id",
	settings: "/orgs/:orgSlug/terminals/settings",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.organizations.apiKeys`. */
export const organizationApiKeysRoutes = {
	list: "/orgs/:orgSlug/api-keys",
	create: "/orgs/:orgSlug/api-keys",
	revoke: "/orgs/:orgSlug/api-keys/:keyId/revoke",
} satisfies Record<string, RouteTree>;
