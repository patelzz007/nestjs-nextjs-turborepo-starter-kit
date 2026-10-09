import { FeatureUnavailableNotice } from "@/components/auth/access-fallback";
import { AccessGate } from "@/components/auth/access-gate";
import { SignupReferralPageView } from "@/components/rewardhub/referrals/signup-referral-page-view";
import { settleServerQuery } from "@workspace/client/lib/api/server-query-outcome";
import { guardWebPage } from "@/lib/auth/page-guard";
import { loginPath, ROUTES } from "@/lib/routes";
import { SIGNUP_REFERRALS_DASHBOARD_PREFETCH_KEY, SIGNUP_REFERRALS_REFEREES_URL_STATE, toSignupReferralRefereesQuery } from "@/lib/url-state/signup-referrals";
import { createWebServerCaller } from "@/lib/web-server-api";
import { redirect } from "next/navigation";
import * as React from "react";

export const dynamic = "force-dynamic";

const REFERRALS_FEATURE = "referrals";

/** `/rewardhub/referrals` — share a signup code and track referees. */
export default async function RewardHubReferralsPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	await guardWebPage(ROUTES.rewardHub.referrals);

	const urlState = SIGNUP_REFERRALS_REFEREES_URL_STATE.parse(await searchParams);
	const server = createWebServerCaller();
	const [dashboardResult, refereesResult] = await Promise.allSettled([
		server.auth.signupReferralsDashboard.query(undefined),
		server.auth.signupReferralsReferees.query(toSignupReferralRefereesQuery(urlState)),
	]);

	const dashboard = settleServerQuery(dashboardResult, { label: "auth.signupReferralsDashboard", expected: ["unauthenticated", "forbidden"] });
	const referees = settleServerQuery(refereesResult, { label: "auth.signupReferralsReferees", expected: ["unauthenticated", "forbidden"] });

	if (dashboard.kind === "unauthenticated" || referees.kind === "unauthenticated") {
		redirect(loginPath(ROUTES.rewardHub.referrals));
	}
	if (dashboard.kind === "forbidden" || referees.kind === "forbidden") {
		return <FeatureUnavailableNotice feature={REFERRALS_FEATURE} />;
	}

	return (
		<AccessGate feature={REFERRALS_FEATURE}>
			<SignupReferralPageView
				initialDashboard={{ stateKey: SIGNUP_REFERRALS_DASHBOARD_PREFETCH_KEY, data: dashboard.data }}
				initialReferees={{ stateKey: SIGNUP_REFERRALS_REFEREES_URL_STATE.serialize(urlState), data: referees.data }}
			/>
		</AccessGate>
	);
}
