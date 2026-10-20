import { apiRouter } from "@workspace/client/lib/api/endpoints";
import type { Envelope, RewardResponse } from "@workspace/shared";
import type { QueryClient } from "@tanstack/react-query";

const rewardsDefs = apiRouter.organizations.rewards;

/**
 * After a reward was created or changed: its own cache entry holds the API's answer (so its page shows it at
 * once), and every cached catalog page and the catalog figures refetch. A page cannot be patched in place: which
 * page and which status tab a reward lands on is the server's decision.
 */
export async function applyMerchantRewardChange(queryClient: QueryClient, orgSlug: string, response: Envelope<RewardResponse>): Promise<void> {
	queryClient.setQueryData(rewardsDefs.get.queryKey({ orgSlug, rewardId: response.data.id }), response);
	await invalidateMerchantRewardsListCache(queryClient, orgSlug);
}

/** Drop every cached catalog page and the catalog figures of the organization, so the next read refetches them. */
export async function invalidateMerchantRewardsListCache(queryClient: QueryClient, orgSlug: string): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: rewardsDefs.list.scopeKey({ orgSlug }) }),
		queryClient.invalidateQueries({ queryKey: rewardsDefs.summary.scopeKey({ orgSlug }) }),
	]);
}
