import { nowEpochMs } from "@workspace/shared";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { resolveSalesPeriodQuery } from "@/lib/analytics/sales-period";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";
import { SALES_ANALYTICS_URL_STATE } from "@/lib/url-state/analytics";

import SalesAnalyticsPanel from "./sales-analytics-panel";

export const dynamic = "force-dynamic";

export interface SalesAnalyticsPageProps {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/analytics/sales` — platform-wide paid POS bills (`GET /admin/analytics/sales`,
 * READ ANALYTICS). `?weeks=4|8|12` picks the period — a shareable filter, so it
 * lives in the URL (`SALES_ANALYTICS_URL_STATE`); the period ends at request
 * time and is computed here once, so the prefetched data and the client query
 * share one query key. A failed prefetch is logged and the client query
 * (with its error state and retry) takes over.
 */
export default async function SalesAnalyticsPage({ searchParams }: SalesAnalyticsPageProps): Promise<React.JSX.Element> {
	const { weeks } = SALES_ANALYTICS_URL_STATE.parse(await searchParams);
	const query = resolveSalesPeriodQuery(weeks, nowEpochMs());

	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/analytics/sales", resource: "sales analytics" }, () => server.rewardsAdmin.salesAnalytics.query(query));

	return <SalesAnalyticsPanel weeks={weeks} query={query} initialAnalytics={resolvePrefetchedData(result)} />;
}
