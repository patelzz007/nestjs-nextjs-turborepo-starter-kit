// API path templates of the inbound half of the `webhooks` context (ADR 081). Composed into `apiRoutes`
// (`src/api-routes.ts`) as `apiRoutes.receivedWebhooks`.

import type { RouteTree } from "../../route-tree";

/** Platform staff: the log of webhooks providers sent this server (AUDIT_LOG LIST / READ). */
export const receivedWebhooksRoutes = {
	list: "/admin/webhooks/received",
	detail: "/admin/webhooks/received/:id",
} satisfies Record<string, RouteTree>;
