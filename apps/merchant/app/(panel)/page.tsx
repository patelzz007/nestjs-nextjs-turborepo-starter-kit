import { MerchantDashboardPageView } from "@/components/dashboard/merchant-dashboard-page-view";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { MerchantAnalyticsResponse, RewardResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

/** Merchant home dashboard — SSR-prefetched analytics and rewards. */
export default async function MerchantDashboardPage(): Promise<React.JSX.Element> {
	const { server, merchantHeaders, memberships, merchantOrgId } = await loadMerchantServerContext();

	const activeMembership = memberships.find((row) => row.merchantOrgId === merchantOrgId) ?? memberships[0];
	const businessName = activeMembership?.businessName ?? "";

	let initialAnalytics: MerchantAnalyticsResponse | undefined;
	let initialRewards: readonly RewardResponse[] | undefined;

	try {
		const [analyticsResponse, rewardsResponse] = await Promise.all([
			server.merchant.analytics.query({}, { headers: merchantHeaders }),
			server.merchant.rewards.list.query({}, { headers: merchantHeaders }),
		]);
		initialAnalytics = analyticsResponse.data;
		initialRewards = rewardsResponse.data;
	} catch {
		initialAnalytics = undefined;
		initialRewards = undefined;
	}

	return <MerchantDashboardPageView businessName={businessName} initialAnalytics={initialAnalytics} initialRewards={initialRewards} />;
}
