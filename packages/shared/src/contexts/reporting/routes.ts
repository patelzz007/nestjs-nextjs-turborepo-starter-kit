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

/** Path templates composed into `apiRoutes.organizations` (analytics, analyticsDashboard, analyticsExport). */
export const organizationAnalyticsRoutes = {
	analytics: "/orgs/:orgSlug/analytics",
	/** The merchant analytics dashboard (custom range + interval, breakdowns). */
	analyticsDashboard: "/orgs/:orgSlug/analytics/dashboard",
	/** The merchant analytics report as a CSV / XLSX / PDF file. */
	analyticsExport: "/orgs/:orgSlug/analytics/export",
} satisfies Record<string, RouteTree>;
