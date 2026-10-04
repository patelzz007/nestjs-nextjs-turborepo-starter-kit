import { FeatureUnavailableNotice } from "@/components/auth/access-fallback";
import { AccessGate } from "@/components/auth/access-gate";
import { MyClaimsPageView } from "@/components/rewardhub/claims/my-claims-page-view";
import { settleServerQuery } from "@/lib/api/server-query-outcome";
import { guardWebPage } from "@/lib/auth/page-guard";
import { loginPath, ROUTES } from "@/lib/routes";
import { toReadyToRedeemCountQuery, toWalletClaimsListQuery, WALLET_CLAIMS_URL_STATE } from "@/lib/url-state/wallet-claims";
import { createWebServerCaller } from "@/lib/web-server-api";
import { redirect } from "next/navigation";
import * as React from "react";

export const dynamic = "force-dynamic";

const WALLET_FEATURE = "your claimed rewards";

/**
 * `/rewardhub/wallet` — the signed-in user's claimed rewards. The server
 * prefetches the page of claims the URL asks for plus the account-wide
 * "ready to redeem" count, in parallel.
 */
export default async function RewardHubWalletPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	await guardWebPage(ROUTES.rewardHub.wallet);

	const urlState = WALLET_CLAIMS_URL_STATE.parse(await searchParams);
	const server = createWebServerCaller();
	const [pageResult, readyCountResult] = await Promise.allSettled([
		server.claims.list.query(toWalletClaimsListQuery(urlState)),
		server.claims.list.query(toReadyToRedeemCountQuery()),
	]);

	const page = settleServerQuery(pageResult, { label: "claims.list", expected: ["unauthenticated", "forbidden"] });
	const readyCount = settleServerQuery(readyCountResult, { label: "claims.list (ready to redeem)", expected: ["unauthenticated", "forbidden"] });

	if (page.kind === "unauthenticated" || readyCount.kind === "unauthenticated") {
		redirect(loginPath(ROUTES.rewardHub.wallet));
	}
	if (page.kind === "forbidden" || readyCount.kind === "forbidden") {
		return <FeatureUnavailableNotice feature={WALLET_FEATURE} />;
	}

	return (
		<AccessGate feature={WALLET_FEATURE}>
			<MyClaimsPageView initialPage={{ stateKey: WALLET_CLAIMS_URL_STATE.serialize(urlState), data: page.data }} initialReadyCount={readyCount.data} />
		</AccessGate>
	);
}
