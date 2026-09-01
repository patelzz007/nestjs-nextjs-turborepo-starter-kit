import { RewardDetailView } from "@/components/rewardhub/reward-detail-view";
import { createWebServerCaller } from "@/lib/web-server-api";
import type { RewardResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

export default async function RewardDetailPage({ params }: { readonly params: Promise<{ rewardId: string }> }): Promise<React.JSX.Element> {
	const { rewardId } = await params;
	const server = createWebServerCaller();

	let initialReward: RewardResponse | undefined;
	try {
		const response = await server.rewards.detail.query({ rewardId });
		initialReward = response.data;
	} catch {
		initialReward = undefined;
	}

	return <RewardDetailView rewardId={rewardId} initialReward={initialReward} />;
}
