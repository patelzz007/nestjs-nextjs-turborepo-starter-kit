import { WebBreadcrumbTailLabel } from "@/components/breadcrumb-tail-label";
import { RewardDetailView } from "@/contexts/rewards/components/detail/view";
import { loadRewardDetail } from "@/contexts/rewards/lib/reward-detail-server";
import { guardWebPage } from "@/contexts/identity/lib/page-guard";
import { rewardDetailPath } from "@/lib/routes";
import * as React from "react";

export const dynamic = "force-dynamic";

/** `/dashboard/rewards/[rewardId]` — signed-in reward detail and claim flow. */
export default async function DashboardRewardDetailPage({ params }: { readonly params: Promise<{ rewardId: string }> }): Promise<React.JSX.Element> {
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
