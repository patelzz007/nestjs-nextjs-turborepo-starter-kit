import { MerchantAnalyticsPageView } from "@/components/analytics/merchant-analytics-page-view";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { MerchantAnalyticsResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

/** Merchant analytics — server-prefetched KPIs and charts. */
export default async function MerchantAnalyticsPage(): Promise<React.JSX.Element> {
	const { server, merchantHeaders } = await loadMerchantServerContext();

	let initialAnalytics: MerchantAnalyticsResponse | undefined;
	try {
		const response = await server.merchant.analytics.query({}, { headers: merchantHeaders });
		initialAnalytics = response.data;
	} catch {
		initialAnalytics = undefined;
	}

	return <MerchantAnalyticsPageView initialAnalytics={initialAnalytics} />;
}
