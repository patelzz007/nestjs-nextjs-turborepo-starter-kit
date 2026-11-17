// API path templates owned by the `feature-flags` context (feature flags v2). Composed into `apiRoutes`.

import type { RouteTree } from "../../route-tree";

export const featureFlagsRoutes = {
	// ── Every app: one subject's results, the live version stream, exposures ──
	/** The caller's evaluated flags and configs for one app (signed in or not). */
	bundle: "/feature-flags/bundle",
	/** The catalogue version, live (SSE; signed in only). */
	stream: "/feature-flags/stream",
	/** A batch of exposures (signed in, or a device for device-unit flags). */
	exposures: "/feature-flags/exposures",

	// ── Admin console: feature flags ──
	list: "/admin/feature-flags",
	environment: "/admin/feature-flags/environment",
	subjects: "/admin/feature-flags/subjects",
	flag: "/admin/feature-flags/:key",
	revisions: "/admin/feature-flags/:key/revisions",
	revisionDecision: "/admin/feature-flags/:key/revisions/:number/decision",
	killSwitch: "/admin/feature-flags/:key/kill-switch",
	overrides: "/admin/feature-flags/:key/overrides",
	removeOverride: "/admin/feature-flags/:key/overrides/:overrideId/remove",
	check: "/admin/feature-flags/:key/check",

	// ── Admin console: dynamic configs ──
	configs: "/admin/dynamic-configs",
	config: "/admin/dynamic-configs/:key",
	configRevisions: "/admin/dynamic-configs/:key/revisions",
	configRevisionDecision: "/admin/dynamic-configs/:key/revisions/:number/decision",
	configCheck: "/admin/dynamic-configs/:key/check",

	// ── Admin console: flag groups ──
	groups: "/admin/flag-groups",
	group: "/admin/flag-groups/:groupId",
	removeGroup: "/admin/flag-groups/:groupId/remove",
	groupMembers: "/admin/flag-groups/:groupId/members",

	// ── Admin console: experiments ──
	experiments: "/admin/experiments",
	experimentMetrics: "/admin/experiments/metrics",
	experiment: "/admin/experiments/:experimentId",
	startExperiment: "/admin/experiments/:experimentId/start",
	stopExperiment: "/admin/experiments/:experimentId/stop",

	// ── Admin console: rule promotion ──
	promotionExport: "/admin/feature-flags/promotion/export",
	promotionPreview: "/admin/feature-flags/promotion/preview",
	promotionImport: "/admin/feature-flags/promotion/import",
} satisfies Record<string, RouteTree>;
