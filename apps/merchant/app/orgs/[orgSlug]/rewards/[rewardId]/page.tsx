import { MerchantRewardDetailPageView } from "@/contexts/rewards/components/merchant-reward-detail-page-view";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { guardOrgPage } from "@/contexts/organizations/lib/org/org-page-guard";
import { prefetchedDataOrUndefined } from "@/lib/server/server-query-outcome";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantRewardDetailPageProps {
	readonly params: Promise<{ orgSlug: string; rewardId: string }>;
}

export default async function MerchantRewardDetailPage({ params }: MerchantRewardDetailPageProps): Promise<React.JSX.Element> {
	const { orgSlug, rewardId } = await params;
	const denied = await guardOrgPage(orgSlug, "/rewards/[rewardId]");
	if (denied !== null) {
		return denied;
	}
	const { server } = await loadMerchantServerContext();

	// An access answer leaves the data to the client query; an outage is logged and rethrown to `error.tsx`.
	const [result] = await Promise.allSettled([server.organizations.rewards.get.query({ orgSlug, rewardId })]);
	const initialReward = prefetchedDataOrUndefined(result, "organizations.rewards.get");

	return <MerchantRewardDetailPageView orgSlug={orgSlug} rewardId={rewardId} initialReward={initialReward} />;
}
