// API path templates of the outbound half of the `webhooks` context (ADR 082). Composed into `apiRoutes`
// (`src/api-routes.ts`) as `apiRoutes.tenantWebhooks`.

import type { RouteTree } from "../../route-tree";

/** A tenant's outgoing webhooks: its endpoints and the delivery log (`merchant:manage_webhooks`). */
export const tenantWebhooksRoutes = {
	endpoints: "/tenants/:tenantSlug/webhooks/endpoints",
	endpoint: "/tenants/:tenantSlug/webhooks/endpoints/:endpointId",
	enableEndpoint: "/tenants/:tenantSlug/webhooks/endpoints/:endpointId/enable",
	disableEndpoint: "/tenants/:tenantSlug/webhooks/endpoints/:endpointId/disable",
	rotateSecret: "/tenants/:tenantSlug/webhooks/endpoints/:endpointId/rotate-secret",
	sendTest: "/tenants/:tenantSlug/webhooks/endpoints/:endpointId/test",
	deliveries: "/tenants/:tenantSlug/webhooks/deliveries",
	redeliver: "/tenants/:tenantSlug/webhooks/deliveries/:deliveryId/redeliver",
} satisfies Record<string, RouteTree>;
