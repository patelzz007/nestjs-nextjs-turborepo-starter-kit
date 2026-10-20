import { FeatureUnavailableNotice } from "@/contexts/identity/components/access-fallback";
import { AccessGate } from "@/contexts/identity/components/access-gate";
import { DashboardAnalyticsPageView } from "@/contexts/reporting/components/analytics-page-view";
import { guardWebPage } from "@/contexts/identity/lib/page-guard";
import { loginPath, ROUTES } from "@/lib/routes";
import { createWebServerCaller } from "@/lib/web-server-api";
import { analyticsPrefetchKey, ANALYTICS_URL_STATE, resolveAnalyticsRange, toAnalyticsRangeQuery } from "@workspace/client/lib/contexts/reporting/analytics-range";
import { settleServerQuery } from "@workspace/client/lib/api/server-query-outcome";
import { CustomerAnalyticsDashboardQuerySchema, nowEpochMs, UTC_TIME_ZONE } from "@workspace/shared";
import { redirect } from "next/navigation";
import * as React from "react";

export const dynamic = "force-dynamic";

const ACTIVITY_FEATURE = "your reward activity";

export interface DashboardActivityPageProps {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/dashboard/activity` — the signed-in customer's own analytics
 * (`GET /claims/analytics/dashboard`). The range lives in the URL
 * (ANALYTICS_URL_STATE), resolved here against the request time in UTC days;
 * the client resolves it from the same `nowMs`, so the prefetch lands under
 * the client query's key.
 */
export default async function DashboardActivityPage({ searchParams }: DashboardActivityPageProps): Promise<React.JSX.Element> {
	await guardWebPage(ROUTES.dashboard.activity);

	const nowMs = nowEpochMs();
	const rangeQuery = toAnalyticsRangeQuery(resolveAnalyticsRange(ANALYTICS_URL_STATE.parse(await searchParams), nowMs, UTC_TIME_ZONE));
	const [result] = await Promise.allSettled([createWebServerCaller().claims.analyticsDashboard.query(CustomerAnalyticsDashboardQuerySchema.parse(rangeQuery))]);
	const dashboard = settleServerQuery(result, { label: "claims.analyticsDashboard", expected: ["unauthenticated", "forbidden"] });

	if (dashboard.kind === "unauthenticated") {
		redirect(loginPath(ROUTES.dashboard.activity));
	}
	if (dashboard.kind === "forbidden") {
		return <FeatureUnavailableNotice feature={ACTIVITY_FEATURE} />;
	}

	return (
		<AccessGate feature={ACTIVITY_FEATURE}>
			<DashboardAnalyticsPageView nowMs={nowMs} initialDashboard={{ stateKey: analyticsPrefetchKey(rangeQuery), data: dashboard.data }} />
		</AccessGate>
	);
}
