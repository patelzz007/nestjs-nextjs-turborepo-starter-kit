import { RewardHubAnalyticsPageView } from "@/components/rewardhub/rewardhub-analytics-page-view";
import { getServerUser } from "@/lib/auth-server";
import { createWebServerCaller } from "@/lib/web-server-api";
import type { UserRewardsAnalyticsResponse } from "@workspace/shared";
import { redirect } from "next/navigation";
import * as React from "react";

export const dynamic = "force-dynamic";

/** User reward activity analytics — requires sign-in. */
export default async function RewardHubAnalyticsPage(): Promise<React.JSX.Element> {
	const user = await getServerUser();
	if (user === null) {
		redirect("/auth/login?redirect=%2Frewardhub%2Fanalytics");
	}

	const server = createWebServerCaller();
	let initialAnalytics: UserRewardsAnalyticsResponse | undefined;

	try {
		const response = await server.claims.analytics.query({});
		initialAnalytics = response.data;
	} catch {
		initialAnalytics = undefined;
	}

	return <RewardHubAnalyticsPageView initialAnalytics={initialAnalytics} />;
}
