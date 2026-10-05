import { MerchantAnalyticsPageView } from "@/components/analytics/merchant-analytics-page-view";
import { toLocationQueryInput } from "@/features/tenant-context/selectors";
import { reportTimeZone } from "@/lib/analytics/merchant-analytics";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import { loadServerLocationScope } from "@/lib/org/server-location-scope";
import { prefetchedDataOrUndefined } from "@/lib/server/server-query-outcome";
import { analyticsPrefetchKey, ANALYTICS_URL_STATE, resolveAnalyticsRange, toAnalyticsRangeQuery } from "@workspace/client/lib/analytics/analytics-range";
import { MerchantAnalyticsDashboardQuerySchema, nowEpochMs } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantAnalyticsPageProps {
	readonly params: Promise<{ orgSlug: string }>;
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PREFETCH_LABEL = "organizations.analyticsDashboard";

/**
 * `/orgs/[orgSlug]/analytics` — the merchant dashboard. The range lives in the
 * URL (ANALYTICS_URL_STATE); the store comes from the member's store selector
 * (the same filter every merchant page uses). Days are cut in the
 * organization's own zone, which the organization context names
 * (`organization.timeZone`) — the range is resolved in it here and, from the
 * same request time, by the client, so the prefetch lands under the client
 * query's key. An access answer (401/403/404) leaves the data to the client
 * query; any other failure goes to `error.tsx`.
 */
export default async function MerchantAnalyticsPage({ params, searchParams }: MerchantAnalyticsPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/analytics");
	if (denied !== null) {
		return denied;
	}
	const urlState = ANALYTICS_URL_STATE.parse(await searchParams);
	const nowMs = nowEpochMs();
	const { server } = await loadMerchantServerContext();
	const scope = await loadServerLocationScope(orgSlug);
	// The same store filter the client's first render derives, so the data lands under its query key.
	const locationId = toLocationQueryInput(scope.effectiveLocationId);
	const timeZone = reportTimeZone(scope.organizationContext?.data);

	const rangeQuery = toAnalyticsRangeQuery(resolveAnalyticsRange(urlState, nowMs, timeZone));
	const [result] = await Promise.allSettled([
		server.organizations.analyticsDashboard.query({ orgSlug, ...MerchantAnalyticsDashboardQuerySchema.parse({ ...rangeQuery, locationId }) }),
	]);
	const data = prefetchedDataOrUndefined(result, PREFETCH_LABEL);
	const initialDashboard = data === undefined ? undefined : { stateKey: analyticsPrefetchKey(rangeQuery, locationId ?? ""), data };

	return <MerchantAnalyticsPageView orgSlug={orgSlug} nowMs={nowMs} timeZone={timeZone} initialDashboard={initialDashboard} />;
}
