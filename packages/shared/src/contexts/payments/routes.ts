// API path templates owned by the `payments` context (ADR 020). Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** A tenant's own payments. The gateways' callbacks (`/payments/callbacks/*`) are server-to-server and have no client route. */
export const tenantPaymentsRoutes = {
	payments: "/tenants/:tenantSlug/payments",
	/** The gateways this deployment is configured for. */
	providers: "/tenants/:tenantSlug/payments/providers",
	payment: "/tenants/:tenantSlug/payments/:paymentId",
	refundPayment: "/tenants/:tenantSlug/payments/:paymentId/refund",
} satisfies Record<string, RouteTree>;
