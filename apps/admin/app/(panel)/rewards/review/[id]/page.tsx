import { AdminRewardPathInputSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import RewardReviewDetailView from "./reward-review-detail";

export const dynamic = "force-dynamic";

/**
 * `/rewards/review/[id]` — one reward in full, approved or rejected from here
 * (MANAGE REWARD). The id is validated with the API's own path schema: a
 * malformed id is a 404, never an API call.
 */
export default async function RewardReviewDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const { id } = await params;
	const parsed = AdminRewardPathInputSchema.safeParse({ rewardId: id });
	if (!parsed.success) {
		notFound();
	}
	const rewardId: string = parsed.data.rewardId;
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/rewards/review/[id]", resource: "reward" }, () => server.rewardsAdmin.getReward.query({ rewardId }));

	return <RewardReviewDetailView rewardId={rewardId} initialReward={resolvePrefetchedData(result)} />;
}
