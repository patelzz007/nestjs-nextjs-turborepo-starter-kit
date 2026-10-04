import { FeatureUnavailableNotice } from "@/components/auth/access-fallback";
import { AccessGate } from "@/components/auth/access-gate";
import { RewardHubAnalyticsPageView } from "@/components/rewardhub/shared/analytics-page-view";
import { settleServerQuery } from "@/lib/api/server-query-outcome";
import { guardWebPage } from "@/lib/auth/page-guard";
import { loginPath, ROUTES } from "@/lib/routes";
import { createWebServerCaller } from "@/lib/web-server-api";
import { redirect } from "next/navigation";
import * as React from "react";

export const dynamic = "force-dynamic";

const ACTIVITY_FEATURE = "your reward activity";

/** User reward activity analytics — requires sign-in. */
export default async function RewardHubActivityPage(): Promise<React.JSX.Element> {
	await guardWebPage(ROUTES.rewardHub.activity);

	const [result] = await Promise.allSettled([createWebServerCaller().claims.analytics.query({})]);
	const analytics = settleServerQuery(result, { label: "claims.analytics", expected: ["unauthenticated", "forbidden"] });

	if (analytics.kind === "unauthenticated") {
		redirect(loginPath(ROUTES.rewardHub.activity));
	}
	if (analytics.kind === "forbidden") {
		return <FeatureUnavailableNotice feature={ACTIVITY_FEATURE} />;
	}

	return (
		<AccessGate feature={ACTIVITY_FEATURE}>
			<RewardHubAnalyticsPageView initialAnalytics={analytics.data} />
		</AccessGate>
	);
}
