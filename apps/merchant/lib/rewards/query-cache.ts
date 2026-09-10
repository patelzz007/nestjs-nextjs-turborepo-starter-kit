import { apiRouter } from "@workspace/client/lib/api/endpoints";
import type { Envelope, RewardResponse } from "@workspace/shared";
import type { QueryClient } from "@tanstack/react-query";

import { stubApiMeta } from "@/lib/api-envelope";

type MerchantRewardsListResponse = Envelope<readonly RewardResponse[]>;

/** Insert or replace a reward in the merchant rewards list react-query cache. */
export function upsertMerchantRewardInListCache(queryClient: QueryClient, reward: RewardResponse): void {
	const listKey = apiRouter.merchant.rewards.list.queryKey({});

	queryClient.setQueryData<MerchantRewardsListResponse>(listKey, (current) => {
		if (current === undefined) {
			return {
				success: true,
				data: [reward],
				meta: stubApiMeta(),
			};
		}

		const withoutDuplicate = current.data.filter((row) => row.id !== reward.id);
		return {
			...current,
			data: [reward, ...withoutDuplicate],
		};
	});
}

/** Drop cached merchant rewards list so the next read refetches from the API. */
export async function invalidateMerchantRewardsListCache(queryClient: QueryClient): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: apiRouter.merchant.rewards.list.queryKey({}) });
}
