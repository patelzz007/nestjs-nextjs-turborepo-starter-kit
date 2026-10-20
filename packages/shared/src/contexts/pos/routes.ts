// API path templates owned by the `pos` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.tenants` (redemptions). */
export const tenantRedemptionsRoutes = {
	redemptions: "/tenants/:tenantSlug/redemptions",
} satisfies Record<string, RouteTree>;

/**
 * Path templates composed into `apiRoutes.integration`: every call a machine makes — a till pairing
 * with its one-time code, then validating and checking out redemptions with its key, and an
 * integration key reading its own redemption history. The tenant and store come from the key (D6).
 */
export const integrationRedemptionsRoutes = {
	redemptions: "/integration/redemptions",
	validateRedemption: "/integration/redemptions/validate",
	checkoutRedemption: "/integration/redemptions/checkout",
	pairTerminal: "/integration/terminals/pair",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.tenants.terminals`. */
export const tenantTerminalsRoutes = {
	list: "/tenants/:tenantSlug/terminals",
	create: "/tenants/:tenantSlug/terminals",
	summary: "/tenants/:tenantSlug/terminals/summary",
	get: "/tenants/:tenantSlug/terminals/:id",
	pairingCode: "/tenants/:tenantSlug/terminals/:id/pairing-code",
	remove: "/tenants/:tenantSlug/terminals/:id",
	settings: "/tenants/:tenantSlug/terminals/settings",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.tenants.apiKeys`. */
export const tenantApiKeysRoutes = {
	list: "/tenants/:tenantSlug/api-keys",
	create: "/tenants/:tenantSlug/api-keys",
	revoke: "/tenants/:tenantSlug/api-keys/:keyId/revoke",
} satisfies Record<string, RouteTree>;
