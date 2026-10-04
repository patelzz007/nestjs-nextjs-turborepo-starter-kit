import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedQuery } from "@/lib/server/prefetch";
import { REWARDS_REVIEW_URL_STATE, toPendingRewardsListQuery } from "@/lib/url-state/rewards-review";

import PendingRewardsPanel from "./pending-rewards-panel";

export const dynamic = "force-dynamic";

export interface RewardsReviewPageProps {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/rewards/review` — moderation queue for rewards awaiting approval. The page
 * of the queue lives in the URL (`?page=&limit=`); the server prefetches that
 * page, and a failed prefetch is logged and left to the client query.
 */
export default async function RewardsReviewPage({ searchParams }: RewardsReviewPageProps): Promise<React.JSX.Element> {
	const urlState = REWARDS_REVIEW_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/rewards/review", resource: "pending rewards" }, () => server.rewardsAdmin.pendingRewards.query(toPendingRewardsListQuery(urlState)));

	return <PendingRewardsPanel initialPage={resolvePrefetchedQuery(REWARDS_REVIEW_URL_STATE.serialize(urlState), result)} />;
}
