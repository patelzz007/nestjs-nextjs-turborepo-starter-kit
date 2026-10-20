import { apiRouter } from "@workspace/client/lib/api/endpoints";
import type { Envelope, RewardResponse } from "@workspace/shared";
import type { QueryClient } from "@tanstack/react-query";

const rewardsDefs = apiRouter.tenants.rewards;

/**
 * After a reward was created or changed: its own cache entry holds the API's answer (so its page shows it at
 * once), and every cached catalog page and the catalog figures refetch. A page cannot be patched in place: which
 * page and which status tab a reward lands on is the server's decision.
 */
export async function applyMerchantRewardChange(queryClient: QueryClient, tenantSlug: string, response: Envelope<RewardResponse>): Promise<void> {
	queryClient.setQueryData(rewardsDefs.get.queryKey({ tenantSlug, rewardId: response.data.id }), response);
	await invalidateMerchantRewardsListCache(queryClient, tenantSlug);
}

/** Drop every cached catalog page and the catalog figures of the tenant, so the next read refetches them. */
export async function invalidateMerchantRewardsListCache(queryClient: QueryClient, tenantSlug: string): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: rewardsDefs.list.scopeKey({ tenantSlug }) }),
		queryClient.invalidateQueries({ queryKey: rewardsDefs.summary.scopeKey({ tenantSlug }) }),
	]);
}
