import { createAdminServerCaller } from "@/lib/admin-server-api";

import PendingRewardsPanel from "./pending-rewards-panel";

export const dynamic = "force-dynamic";

/** `/rewards/review` — moderation queue for rewards awaiting approval. */
export default async function RewardsReviewPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const result = await Promise.allSettled([server.rewardsAdmin.pendingRewards.query({})]);

	const first = result[0];
	const initialRewards = first.status === "fulfilled" ? first.value.data : undefined;

	return <PendingRewardsPanel initialRewards={initialRewards} />;
}
