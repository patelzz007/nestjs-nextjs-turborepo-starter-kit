import { nowEpochMs } from "@workspace/shared";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { parseSalesPeriodWeeks, resolveSalesPeriodQuery } from "@/lib/analytics/sales-period";
import { SALES_PERIOD_WEEKS_PARAM } from "@/lib/routes";

import SalesAnalyticsPanel from "./sales-analytics-panel";

export const dynamic = "force-dynamic";

/**
 * `/analytics/sales` — platform-wide paid POS bills (`GET /admin/analytics/sales`,
 * READ ANALYTICS). `?weeks=4|8|12` picks the period — a shareable filter, so it
 * lives in the URL; the period ends at request time and is computed here once,
 * so the prefetched data and the client query share one query key.
 */
export default async function SalesAnalyticsPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const params = await searchParams;
	const weeks = parseSalesPeriodWeeks(params[SALES_PERIOD_WEEKS_PARAM]);
	const query = resolveSalesPeriodQuery(weeks, nowEpochMs());

	const server = createAdminServerCaller();
	const [result] = await Promise.allSettled([server.rewardsAdmin.salesAnalytics.query(query)]);
	const initialAnalytics = result.status === "fulfilled" ? result.value.data : undefined;

	return <SalesAnalyticsPanel weeks={weeks} query={query} initialAnalytics={initialAnalytics} />;
}
