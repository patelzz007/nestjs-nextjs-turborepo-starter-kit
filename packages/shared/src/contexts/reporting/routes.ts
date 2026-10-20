// API path templates owned by the `reporting` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.rewardsAdmin` (salesAnalytics, analyticsDashboard, analyticsExport). */
export const rewardsAdminAnalyticsRoutes = {
	salesAnalytics: "/admin/analytics/sales",
	/** The platform analytics dashboard (custom range + interval, breakdowns). */
	analyticsDashboard: "/admin/analytics/dashboard",
	/** The platform analytics report as a CSV / XLSX / PDF file. */
	analyticsExport: "/admin/analytics/export",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.claims` (analytics, analyticsDashboard). */
export const claimsAnalyticsRoutes = {
	analytics: "/claims/analytics",
	/** The customer's analytics dashboard (custom range + interval). */
	analyticsDashboard: "/claims/analytics/dashboard",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.integration`: an integration API key's own analytics (tenant from the key, D6). */
export const integrationAnalyticsRoutes = {
	analytics: "/integration/analytics",
	analyticsDashboard: "/integration/analytics/dashboard",
	analyticsExport: "/integration/analytics/export",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.tenants` (analytics, analyticsDashboard, analyticsExport). */
export const tenantAnalyticsRoutes = {
	analytics: "/tenants/:tenantSlug/analytics",
	/** The merchant analytics dashboard (custom range + interval, breakdowns). */
	analyticsDashboard: "/tenants/:tenantSlug/analytics/dashboard",
	/** The merchant analytics report as a CSV / XLSX / PDF file. */
	analyticsExport: "/tenants/:tenantSlug/analytics/export",
} satisfies Record<string, RouteTree>;
