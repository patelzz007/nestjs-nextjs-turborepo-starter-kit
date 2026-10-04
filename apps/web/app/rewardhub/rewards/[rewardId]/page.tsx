import { WebBreadcrumbTailLabel } from "@/components/breadcrumb-tail-label";
import { RewardDetailView } from "@/components/rewardhub/detail/view";
import { loadRewardDetail } from "@/lib/rewards/reward-detail-server";
import { guardWebPage } from "@/lib/auth/page-guard";
import { rewardDetailPath } from "@/lib/routes";
import * as React from "react";

export const dynamic = "force-dynamic";

/** `/rewardhub/rewards/[rewardId]` — signed-in reward detail and claim flow. */
export default async function RewardHubRewardDetailPage({ params }: { readonly params: Promise<{ rewardId: string }> }): Promise<React.JSX.Element> {
	const { rewardId } = await params;
	await guardWebPage(rewardDetailPath(rewardId));

	const reward = await loadRewardDetail(rewardId);

	return (
		<>
			<WebBreadcrumbTailLabel label={reward.data.title} />
			<RewardDetailView rewardId={reward.data.id} initialReward={reward} />
		</>
	);
}
