// API path templates owned by the `rewards` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.rewardsAdmin` (rewardsPending, rewardDetail, rewardApprove, rewardReject, rewardImageDownload, rewardImagesArchive). */
export const rewardsAdminRewardRoutes = {
	rewardsPending: "/admin/rewards/pending",
	/** One reward in full, any status — the moderation detail page. */
	rewardDetail: "/admin/rewards/:rewardId",
	rewardApprove: "/admin/rewards/:rewardId/approve",
	rewardReject: "/admin/rewards/:rewardId/reject",
	/** A short-lived signed URL that downloads one of a reward's images (the original upload). */
	rewardImageDownload: "/admin/rewards/:rewardId/images/:fileId/download",
	rewardImagesArchive: "/admin/rewards/:rewardId/images/archive",
} satisfies Record<string, RouteTree>;

// ── Rewards platform (Phase 1) ─────────────────────────────────────

/** Path templates composed into `apiRoutes.rewards`. */
export const rewardsRoutes = {
	list: "/rewards",
	detail: "/rewards/:rewardId",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.legal`. */
export const legalRoutes = {
	accept: "/legal/accept",
	status: "/legal/status",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.tenants.rewards`. */
/**
 * Path templates composed into `apiRoutes.integration.rewards`: an integration API key's own catalog.
 * The tenant (and store, for a store-scoped key) comes from the key, so the path names none (D6).
 */
export const integrationRewardsRoutes = {
	list: "/integration/rewards",
	summary: "/integration/rewards/summary",
	create: "/integration/rewards",
	get: "/integration/rewards/:rewardId",
	update: "/integration/rewards/:rewardId",
	publish: "/integration/rewards/:rewardId/publish",
} satisfies Record<string, RouteTree>;

export const tenantRewardsRoutes = {
	list: "/tenants/:tenantSlug/rewards",
	summary: "/tenants/:tenantSlug/rewards/summary",
	create: "/tenants/:tenantSlug/rewards",
	get: "/tenants/:tenantSlug/rewards/:rewardId",
	update: "/tenants/:tenantSlug/rewards/:rewardId",
	publish: "/tenants/:tenantSlug/rewards/:rewardId/publish",
} satisfies Record<string, RouteTree>;
