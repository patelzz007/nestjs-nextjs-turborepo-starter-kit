import { MerchantEditRewardPageView } from "@/components/rewards/merchant-edit-reward-page-view";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import { prefetchedDataOrUndefined } from "@/lib/server/server-query-outcome";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantEditRewardPageProps {
	readonly params: Promise<{ orgSlug: string; rewardId: string }>;
}

export default async function MerchantEditRewardPage({ params }: MerchantEditRewardPageProps): Promise<React.JSX.Element> {
	const { orgSlug, rewardId } = await params;
	const denied = await guardOrgPage(orgSlug, "/rewards/[rewardId]/edit");
	if (denied !== null) {
		return denied;
	}
	const { server } = await loadMerchantServerContext();

	// No merchant reward-detail endpoint exists yet: the editor reads the reward out of the list.
	// An access answer leaves the data to the client query; an outage is logged and rethrown to `error.tsx`.
	const [result] = await Promise.allSettled([server.organizations.rewards.list.query({ orgSlug })]);
	const initialRewards = prefetchedDataOrUndefined(result, "organizations.rewards.list");

	return <MerchantEditRewardPageView orgSlug={orgSlug} rewardId={rewardId} initialRewards={initialRewards} />;
}
