import { MerchantAnalyticsPageView } from "@/components/analytics/merchant-analytics-page-view";
import { toLocationQueryInput } from "@/features/tenant-context/selectors";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { LocationScopedPrefetch } from "@/lib/org/location-prefetch";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import { loadServerLocationScope } from "@/lib/org/server-location-scope";
import { prefetchedDataOrUndefined } from "@/lib/server/server-query-outcome";
import type { Envelope, MerchantAnalyticsResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantAnalyticsPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

export default async function MerchantAnalyticsPage({ params }: MerchantAnalyticsPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/analytics");
	if (denied !== null) {
		return denied;
	}
	const { server } = await loadMerchantServerContext();
	// The same store filter the client's first render derives, so the data lands under its query key.
	const locationId = toLocationQueryInput((await loadServerLocationScope(orgSlug)).effectiveLocationId);

	// An access answer (401/403/404) leaves the data to the client query, which renders that state;
	// any other failure is logged and rethrown to `error.tsx`.
	const [result] = await Promise.allSettled([server.organizations.analytics.query({ orgSlug, locationId })]);
	const analytics = prefetchedDataOrUndefined(result, "organizations.analytics");
	const initialAnalytics: LocationScopedPrefetch<Envelope<MerchantAnalyticsResponse>> | undefined = analytics === undefined ? undefined : { locationId, data: analytics };

	return <MerchantAnalyticsPageView orgSlug={orgSlug} initialAnalytics={initialAnalytics} />;
}
