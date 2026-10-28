import { resolve } from "node:path";
import { Reflector } from "@nestjs/core";
import { beforeAll, describe, expect, it } from "vitest";

import { AUDIT_READ_OPERATION, AUDIT_TRAIL_READ_OPERATION, DATA_CHANGE_READ_OPERATION } from "../contexts/audit/application/audit-read-operations";
import { AuditLogsController } from "../contexts/audit/presentation/http/audit-logs.controller";
import { AuditTrailController } from "../contexts/audit/presentation/http/audit-trail.controller";
import { DataChangesController } from "../contexts/audit/presentation/http/data-changes.controller";
import { CATALOG_READ_OPERATION } from "../contexts/catalog/application/catalog.tokens";
import { KANBAN_READ_OPERATION } from "../contexts/kanban/application/ports/kanban.tokens";
import { KanbanController } from "../contexts/kanban/presentation/http/kanban.controller";
import { ProductController } from "../contexts/catalog/presentation/http/product.controller";
import { SampleCategoryController } from "../contexts/catalog/presentation/http/sample-category.controller";
import { EmailLogController } from "../contexts/notifications/presentation/http/email-log.controller";
import { EmailPreviewController } from "../contexts/notifications/presentation/http/email-preview.controller";
import { EMAIL_LOG_LIST_OPERATION } from "../contexts/notifications/application/ports/notifications.tokens";
import { GEO_READ_OPERATION } from "../contexts/reference-data/application/ports/reference-data.tokens";
import { GeoController } from "../contexts/reference-data/presentation/http/geo.controller";
import { REWARDS_ADMIN_REVIEW_OPERATION } from "../contexts/rewards/application/ports/rewards.tokens";
import { RewardsAdminRewardsController } from "../contexts/rewards/presentation/http/admin-rewards.controller";
import { RewardsAdminAnalyticsController } from "../contexts/reporting/presentation/http/admin-analytics.controller";
import {
	RewardsAdminInvitesController,
	RewardsAdminLocationRequestsController,
	RewardsAdminMerchantsController,
} from "../contexts/tenancy/presentation/http/merchant-admin.controller";
import { ADMIN_ACCESS_MESSAGE_KEY } from "../platform/presentation/http/security/admin-access";
import { PLATFORM_OPERATION_KEY } from "../platform/presentation/http/security/decorators/platform-operation.decorator";
import { PUBLIC_OPERATION_KEY } from "../platform/presentation/http/security/decorators/public-operation.decorator";
import { REQUIRED_PERMISSION_KEY, type RequiredPermission } from "../platform/presentation/http/security/decorators/route-requirements.metadata";
import { SUPER_ADMIN_KEY } from "../platform/presentation/http/security/decorators/super-admin.decorator";
import { discoverControllerRoutes, routeMetadataOf, type ControllerRoute } from "../../test/support/controller-routes";
import { handlerOf } from "../../test/support/route-metadata";

const reflector = new Reflector();

/** What `Reflector.get` reads metadata off: a controller class or one of its methods. */
type MetadataTarget = Parameters<Reflector["get"]>[1];

function operationOf(handler: MetadataTarget, controller: MetadataTarget): string | undefined {
	return reflector.getAllAndOverride<string | undefined>(PLATFORM_OPERATION_KEY, [handler, controller]);
}

/** Whether a route's `@RequirePermission`s include one over a whole collection (no record target). */
function requiresCollectionPermission(route: ControllerRoute): boolean {
	const requirements = reflector.get<readonly RequiredPermission[] | undefined>(REQUIRED_PERMISSION_KEY, route.handler) ?? [];
	return requirements.some((requirement) => requirement.resourceId === undefined);
}

/**
 * An admin-console route: it requires admin access, a superadmin, or a platform
 * permission over a collection (`@RequirePermission` without a record target, checked
 * against the JWT's platform grants), or it is served under `/admin`. Self-service routes
 * (a target of `self()`) and tenant routes (the tenant's membership) never match.
 */
function isAdminConsoleRoute(route: ControllerRoute): boolean {
	return (
		routeMetadataOf(route, SUPER_ADMIN_KEY) === true ||
		routeMetadataOf(route, ADMIN_ACCESS_MESSAGE_KEY) !== undefined ||
		requiresCollectionPermission(route) ||
		route.path.split("/").includes("admin")
	);
}

/**
 * Admin-console routes that run no SQL outside the caller's own user-owned rows, so they need no
 * system operation (identity alone never widens the scope, D20). Each entry says why; a new
 * admin route lands here only with the same justification.
 */
const NO_SYSTEM_OPERATION_ROUTES: ReadonlyMap<string, string> = new Map<string, string>([
	["AuditTrailController.stream", "Server-sent events relayed from a Postgres LISTEN channel; the stream reads no table"],
	["EmailPreviewController.list", "Renders the email templates in memory; reads no table"],
	["EmailPreviewController.detail", "Renders one email template in memory; reads no table"],
	["RewardsAdminInvitesController.previewInviteEmail", "Renders the invite email template in memory; reads no table"],
	["RewardsAdminInvitesController.getInviteAvailability", "Answers from the deployment's tenancy configuration; reads no table"],
	["GithubAccountController.status", "Reads the caller's own GithubAccountLink (user-owned RLS)"],
	["GithubAccountController.link", "Writes the caller's own GithubAccountLink (user-owned RLS)"],
	["GithubAccountController.unlink", "Soft-deletes the caller's own GithubAccountLink (user-owned RLS)"],
	["GithubContentEditsController.contentEdits", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubLiveUpdatesController.status", "The caller's own link; the subscription table is read under github.webhook.subscriptions inside the service"],
	["GithubLiveUpdatesController.enable", "The caller's own link; the subscription write runs under github.webhook.subscriptions inside the service"],
	["GithubLiveUpdatesController.disable", "The caller's own link; the subscription write runs under github.webhook.subscriptions inside the service"],
	["GithubLiveUpdatesController.stream", "Server-sent events relayed from a Postgres LISTEN channel; the stream reads no table"],
	["GithubPicturesController.file", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPicturesController.upload", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.list", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.detail", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.timeline", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.commits", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.status", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.commit", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.addComment", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.submitReview", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.merge", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.attachPicture", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.setReaction", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.files", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubPullRequestsController.reviewThreads", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubController.listRepositories", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubController.getRepositorySummary", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubController.getCommitPage", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubController.getCommit", "GitHub API call with the caller's own link (user-owned RLS)"],
	["GithubController.getContributorStats", "GitHub API call with the caller's own link (user-owned RLS)"],
]);

describe("PLAT-005: every admin-console route declares its platform operation", () => {
	let routes: readonly ControllerRoute[] = [];

	beforeAll(async () => {
		routes = await discoverControllerRoutes(resolve(import.meta.dirname, ".."));
	});

	it("discovers the API's controllers", () => {
		expect(routes.filter(isAdminConsoleRoute).length).toBeGreaterThan(NO_SYSTEM_OPERATION_ROUTES.size);
	});

	it("names a @PlatformOperation on every admin-console route that reads a table", () => {
		const missing: string[] = routes
			.filter(isAdminConsoleRoute)
			.filter((route): boolean => !NO_SYSTEM_OPERATION_ROUTES.has(route.id) && routeMetadataOf(route, PLATFORM_OPERATION_KEY) === undefined)
			.map((route): string => `${route.id} (${route.path})`);

		expect(missing).toEqual([]);
	});

	it("keeps the no-operation list exact: each entry is an admin route that names no operation", () => {
		const byId: ReadonlyMap<string, ControllerRoute> = new Map(routes.map((route): [string, ControllerRoute] => [route.id, route]));
		for (const id of NO_SYSTEM_OPERATION_ROUTES.keys()) {
			const route: ControllerRoute | undefined = byId.get(id);
			expect(route, id).toBeDefined();
			if (route !== undefined) {
				expect({ id, admin: isAdminConsoleRoute(route), operation: routeMetadataOf(route, PLATFORM_OPERATION_KEY) }).toEqual({ id, admin: true, operation: undefined });
			}
		}
	});

	it("never puts a public operation on an admin-console route, nor both decorators on any route", () => {
		const adminPublic: string[] = routes
			.filter(isAdminConsoleRoute)
			.filter((route): boolean => routeMetadataOf(route, PUBLIC_OPERATION_KEY) !== undefined)
			.map((route): string => route.id);
		const both: string[] = routes
			.filter((route): boolean => routeMetadataOf(route, PLATFORM_OPERATION_KEY) !== undefined && routeMetadataOf(route, PUBLIC_OPERATION_KEY) !== undefined)
			.map((route): string => route.id);

		expect({ adminPublic, both }).toEqual({ adminPublic: [], both: [] });
	});
});

/**
 * Admin pages from `apps/admin/lib/navigation` page-API coverage, and the API
 * handler each one calls on load, with the exact operation it names.
 */
const PAGE_LOAD_ROUTES: readonly (readonly [string, MetadataTarget, MetadataTarget, string])[] = [
	[
		"GET /admin/analytics/dashboard",
		handlerOf(RewardsAdminAnalyticsController.prototype, "getDashboard"),
		RewardsAdminAnalyticsController,
		"reporting.platform_analytics.read",
	],
	["GET /product", handlerOf(ProductController.prototype, "list"), ProductController, CATALOG_READ_OPERATION],
	["GET /product/:id", handlerOf(ProductController.prototype, "get"), ProductController, CATALOG_READ_OPERATION],
	["GET /sample-category", handlerOf(SampleCategoryController.prototype, "list"), SampleCategoryController, CATALOG_READ_OPERATION],
	["GET /sample-category/:id", handlerOf(SampleCategoryController.prototype, "get"), SampleCategoryController, CATALOG_READ_OPERATION],
	["GET /notifications/email-log", handlerOf(EmailLogController.prototype, "list"), EmailLogController, EMAIL_LOG_LIST_OPERATION],
	["GET /admin/audit-trail", handlerOf(AuditTrailController.prototype, "list"), AuditTrailController, AUDIT_TRAIL_READ_OPERATION],
	["GET /admin/audit-logs/:id", handlerOf(AuditLogsController.prototype, "get"), AuditLogsController, AUDIT_READ_OPERATION],
	["GET /admin/data-changes", handlerOf(DataChangesController.prototype, "list"), DataChangesController, DATA_CHANGE_READ_OPERATION],
	["GET /admin/data-changes/:id", handlerOf(DataChangesController.prototype, "get"), DataChangesController, DATA_CHANGE_READ_OPERATION],
	["GET /geo/stats", handlerOf(GeoController.prototype, "getStats"), GeoController, GEO_READ_OPERATION],
	["GET /admin/merchants", handlerOf(RewardsAdminMerchantsController.prototype, "listMerchants"), RewardsAdminMerchantsController, "tenant.merchant.admin_read"],
	[
		"GET /admin/location-requests",
		handlerOf(RewardsAdminLocationRequestsController.prototype, "listLocationRequests"),
		RewardsAdminLocationRequestsController,
		"tenant.location.admin_list",
	],
	["GET /admin/rewards/pending", handlerOf(RewardsAdminRewardsController.prototype, "listPendingRewards"), RewardsAdminRewardsController, REWARDS_ADMIN_REVIEW_OPERATION],
	["GET /admin/rewards/:rewardId", handlerOf(RewardsAdminRewardsController.prototype, "getReward"), RewardsAdminRewardsController, REWARDS_ADMIN_REVIEW_OPERATION],
	["GET /admin/kanban/board", handlerOf(KanbanController.prototype, "board"), KanbanController, KANBAN_READ_OPERATION],
	["GET /admin/kanban/tasks/:taskId", handlerOf(KanbanController.prototype, "task"), KanbanController, KANBAN_READ_OPERATION],
	["GET /admin/kanban/tasks/:taskId/comments", handlerOf(KanbanController.prototype, "comments"), KanbanController, KANBAN_READ_OPERATION],
];

/** Template renders. They do not read a table, so they have no system operation. */
const NO_TABLE_ROUTES: readonly (readonly [string, MetadataTarget, MetadataTarget])[] = [
	["GET /notifications/email-preview", handlerOf(EmailPreviewController.prototype, "list"), EmailPreviewController],
	["GET /notifications/email-preview/:key", handlerOf(EmailPreviewController.prototype, "detail"), EmailPreviewController],
	["GET /admin/invites/preview-email", handlerOf(RewardsAdminInvitesController.prototype, "previewInviteEmail"), RewardsAdminInvitesController],
];

describe("platform operation coverage for admin page loads", () => {
	it("names an operation for every admin page load that reads a table", () => {
		for (const [endpoint, handler, controller, operation] of PAGE_LOAD_ROUTES) {
			expect(operationOf(handler, controller), endpoint).toBe(operation);
		}
	});

	it("leaves template renders unnamed and not on the route-wide bypass", () => {
		for (const [endpoint, handler, controller] of NO_TABLE_ROUTES) {
			expect(operationOf(handler, controller), endpoint).toBeUndefined();
		}
	});
});
