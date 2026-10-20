// API path templates owned by the `audit` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

// ── Global HTTP audit trail (admin viewer) ───────────────────────────

/** Path templates composed into `apiRoutes.auditLogs`. */
export const auditLogsRoutes = {
	list: "/admin/audit-logs",
	detail: "/admin/audit-logs/:id",
} satisfies Record<string, RouteTree>;

// ── The audit log's timeline: requests + background writes (admin) ───

/** Path templates composed into `apiRoutes.auditTrail`. */
export const auditTrailRoutes = {
	list: "/admin/audit-trail",
	/** Server-Sent Events: a signal per burst of new entries (no JSON contract — a stream). */
	events: "/admin/audit-trail/events",
} satisfies Record<string, RouteTree>;

// ── Row-level data-change trail (admin viewer) ───────────────────────

/** Path templates composed into `apiRoutes.dataChanges`. */
export const dataChangesRoutes = {
	list: "/admin/data-changes",
	detail: "/admin/data-changes/:id",
} satisfies Record<string, RouteTree>;
