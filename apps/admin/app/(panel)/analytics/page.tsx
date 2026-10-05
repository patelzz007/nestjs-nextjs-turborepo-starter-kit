import { analyticsPrefetchKey, ANALYTICS_URL_STATE, resolveAnalyticsRange, toAnalyticsRangeQuery } from "@workspace/client/lib/analytics/analytics-range";
import { AdminAnalyticsDashboardQuerySchema, nowEpochMs, UTC_TIME_ZONE } from "@workspace/shared";
import * as React from "react";

import { PlatformAnalyticsDashboard } from "@/components/analytics/platform-analytics-dashboard";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedQuery } from "@/lib/server/prefetch";

export const dynamic = "force-dynamic";

export interface AnalyticsPageProps {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/analytics` — the platform dashboard (`GET /admin/analytics/dashboard`,
 * READ ANALYTICS; the route guard checks it). The range lives in the URL
 * (`?range=`, `?from=&to=`, `?interval=` — ANALYTICS_URL_STATE) so a view is
 * shareable; it is resolved here against the request time, in UTC days, and
 * the client resolves it from the same `nowMs`, so the prefetched answer
 * lands under the client query's key. A failed prefetch is logged and the
 * client query (with its error state and retry) takes over.
 */
export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps): Promise<React.JSX.Element> {
	const nowMs = nowEpochMs();
	const rangeQuery = toAnalyticsRangeQuery(resolveAnalyticsRange(ANALYTICS_URL_STATE.parse(await searchParams), nowMs, UTC_TIME_ZONE));
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/analytics", resource: "analytics dashboard" }, () =>
		server.rewardsAdmin.analyticsDashboard.query(AdminAnalyticsDashboardQuerySchema.parse(rangeQuery)),
	);

	return <PlatformAnalyticsDashboard nowMs={nowMs} initialDashboard={resolvePrefetchedQuery(analyticsPrefetchKey(rangeQuery), result)} />;
}
