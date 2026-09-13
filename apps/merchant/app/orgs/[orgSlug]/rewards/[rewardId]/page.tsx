import { MerchantEditRewardPageView } from "@/components/rewards/merchant-edit-reward-page-view";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { RewardResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantEditRewardPageProps {
	readonly params: Promise<{ orgSlug: string; rewardId: string }>;
}

export default async function MerchantEditRewardPage({ params }: MerchantEditRewardPageProps): Promise<React.JSX.Element> {
	const { orgSlug, rewardId } = await params;
	const { server } = await loadMerchantServerContext();

	let initialRewards: readonly RewardResponse[] | undefined;
	try {
		const response = await server.organizations.rewards.list.query({ orgSlug });
		initialRewards = response.data;
	} catch {
		initialRewards = undefined;
	}

	return <MerchantEditRewardPageView orgSlug={orgSlug} rewardId={rewardId} initialRewards={initialRewards} />;
}
