import { WebBreadcrumbTailLabel } from "@/components/breadcrumb-tail-label";
import { RewardDetailView } from "@/components/rewardhub/detail/view";
import { createWebServerCaller } from "@/lib/web-server-api";
import type { RewardResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

/** `/rewardhub/rewards/[rewardId]` — signed-in reward detail and claim flow. */
export default async function RewardHubRewardDetailPage({ params }: { readonly params: Promise<{ rewardId: string }> }): Promise<React.JSX.Element> {
	const { rewardId } = await params;
	const server = createWebServerCaller();

	let initialReward: RewardResponse | undefined;
	try {
		const response = await server.rewards.detail.query({ rewardId });
		initialReward = response.data;
	} catch {
		initialReward = undefined;
	}

	return (
		<>
			<WebBreadcrumbTailLabel label={initialReward?.title} />
			<RewardDetailView rewardId={rewardId} initialReward={initialReward} />
		</>
	);
}
