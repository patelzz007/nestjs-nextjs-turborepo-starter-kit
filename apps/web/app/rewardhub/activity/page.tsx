import { AccessGate } from "@/components/auth/access-gate";
import { RewardHubAnalyticsPageView } from "@/components/rewardhub/shared/analytics-page-view";
import { getServerUser } from "@/lib/auth/server";
import { loginPath, ROUTES } from "@/lib/routes";
import { createWebServerCaller } from "@/lib/web-server-api";
import type { UserRewardsAnalyticsResponse } from "@workspace/shared";
import { redirect } from "next/navigation";
import * as React from "react";

export const dynamic = "force-dynamic";

/** User reward activity analytics — requires sign-in. */
export default async function RewardHubActivityPage(): Promise<React.JSX.Element> {
	const user = await getServerUser();
	if (user === null) {
		redirect(loginPath(ROUTES.rewardHub.activity));
	}

	const server = createWebServerCaller();
	let initialAnalytics: UserRewardsAnalyticsResponse | undefined;

	try {
		const response = await server.claims.analytics.query({});
		initialAnalytics = response.data;
	} catch {
		initialAnalytics = undefined;
	}

	return (
		<AccessGate feature="your reward activity">
			<RewardHubAnalyticsPageView initialAnalytics={initialAnalytics} />
		</AccessGate>
	);
}
