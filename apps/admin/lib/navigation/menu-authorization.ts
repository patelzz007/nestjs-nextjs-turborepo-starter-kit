import { PERMISSION } from "@workspace/shared";

import type { SidebarAuthorization } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

import { ROUTES } from "@/lib/routes";

/**
 * Sidebar item URL → the capability its page needs, mirroring the API route
 * the page loads (`@RequirePermission` on the Nest controller). Kept in
 * TypeScript so every slug is a compile-checked `PERMISSION.*` value; the
 * same requirement drives the sidebar, the command palette, and the route
 * guard (via `buildRouteAuthorizationRules`). `@SuperAdminOnly` pages have no
 * slug — they are listed in the route rules as `superAdminOnly` instead.
 */
export const ADMIN_MENU_AUTHORIZATION: ReadonlyMap<string, SidebarAuthorization> = new Map<string, SidebarAuthorization>([
	// GET /admin/analytics/dashboard + /admin/analytics/export (READ ANALYTICS)
	[ROUTES.analytics.index, { permissions: [PERMISSION.ANALYTICS.READ] }],
	// GET /notifications/email-preview (READ EMAIL)
	[ROUTES.emails.templates, { permissions: [PERMISSION.EMAIL.READ] }],
	// GET /notifications/email-log (LIST EMAIL)
	[ROUTES.emails.log, { permissions: [PERMISSION.EMAIL.LIST] }],
	// GET /admin/audit-trail (LIST AUDIT_LOG)
	[ROUTES.auditLogs.list, { permissions: [PERMISSION.AUDIT_LOG.LIST] }],
	// GET /admin/webhooks/received (LIST AUDIT_LOG)
	[ROUTES.webhooks.received, { permissions: [PERMISSION.AUDIT_LOG.LIST] }],
	// GET /geo/stats, /geo/countries… (READ GEO)
	[ROUTES.geography.index, { permissions: [PERMISSION.GEO.READ] }],
	// GET /admin/merchants (LIST MERCHANT_ORG). The "Merchants" section shares
	// this URL with its "All merchants" index child, so both carry it.
	[ROUTES.merchants.list, { permissions: [PERMISSION.MERCHANT_ORG.LIST] }],
	// GET /admin/rewards/pending (APPROVE REWARD — the moderation queue)
	[ROUTES.rewards.review, { permissions: [PERMISSION.REWARD.APPROVE] }],
	// GET /admin/invites/preview-email (live preview), POST /admin/invites (CREATE MERCHANT_ORG)
	[ROUTES.merchants.invites, { permissions: [PERMISSION.MERCHANT_ORG.CREATE] }],
	// GET /admin/merchants/:id (LIST MERCHANT_ORG)
	[ROUTES.merchants.verification, { permissions: [PERMISSION.MERCHANT_ORG.LIST] }],
	// GET /admin/location-requests (LIST MERCHANT_ORG)
	[ROUTES.merchants.storeRequests, { permissions: [PERMISSION.MERCHANT_ORG.LIST] }],
	// GET /sample-category (LIST SAMPLE_CATEGORY)
	[ROUTES.catalog.categories.list, { permissions: [PERMISSION.SAMPLE_CATEGORY.LIST] }],
	// GET /product (LIST PRODUCT)
	[ROUTES.catalog.products.list, { permissions: [PERMISSION.PRODUCT.LIST] }],
	// GET /admin/kanban/board (LIST KANBAN_TASK)
	[ROUTES.kanban.board, { permissions: [PERMISSION.KANBAN_TASK.LIST] }],
	// GET /admin/operations/overview (the servers page) and /alerts (LIST SERVER_METRIC); GET /admin/operations/load-tests (LIST LOAD_TEST)
	[ROUTES.operations.servers, { permissions: [PERMISSION.SERVER_METRIC.LIST] }],
	[ROUTES.operations.alerts, { permissions: [PERMISSION.SERVER_METRIC.LIST] }],
	[ROUTES.operations.loadTests, { permissions: [PERMISSION.LOAD_TEST.LIST] }],
	// GET /admin/operations/rate-limits (LIST RATE_LIMIT) · GET /admin/operations/cache (READ CACHE)
	[ROUTES.operations.rateLimits, { permissions: [PERMISSION.RATE_LIMIT.LIST] }],
	[ROUTES.operations.cache, { permissions: [PERMISSION.CACHE.READ] }],
	// GET /admin/operations/queues (LIST BACKGROUND_JOB)
	[ROUTES.operations.queues, { permissions: [PERMISSION.BACKGROUND_JOB.LIST] }],
	// GET /admin/operations/status/incidents (LIST STATUS_INCIDENT)
	[ROUTES.operations.statusIncidents, { permissions: [PERMISSION.STATUS_INCIDENT.LIST] }],
	// GET /admin/broadcasts (LIST BROADCAST)
	[ROUTES.emails.broadcasts, { permissions: [PERMISSION.BROADCAST.LIST] }],
	// GET /github/account (READ GITHUB_PULL_REQUEST) · PUT + DELETE /github/account (UPDATE GITHUB_PULL_REQUEST)
	[ROUTES.account.github, { permissions: [PERMISSION.GITHUB_PULL_REQUEST.READ, PERMISSION.GITHUB_PULL_REQUEST.UPDATE], mode: "all" }],
]);

/** Moved to @workspace/shared (lib/navigation-menu) so the mobile drawer applies its requirements the same way. */
export { applyMenuAuthorization } from "@workspace/shared";
