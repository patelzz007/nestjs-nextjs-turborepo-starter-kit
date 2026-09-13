import { apiRouter } from "@workspace/client/lib/api/endpoints";
import type { Envelope, RewardResponse } from "@workspace/shared";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { stubApiMeta } from "@/lib/api-envelope";

type MerchantRewardsListResponse = Envelope<readonly RewardResponse[]>;

const rewardsListDef = apiRouter.organizations.rewards.list;

function merchantRewardsListQueryKeyPrefix(orgSlug: string): QueryKey {
	return rewardsListDef.queryKey({ orgSlug, locationId: undefined }).slice(0, -1);
}

function readLocationIdFromRewardsListQueryKey(queryKey: QueryKey): string | undefined {
	const locationId = queryKey[queryKey.length - 1];
	return typeof locationId === "string" ? locationId : undefined;
}

function rewardMatchesLocationFilter(reward: RewardResponse, locationId: string | undefined): boolean {
	if (reward.locationScopeType === "ALL_LOCATIONS") {
		return true;
	}

	if (locationId === undefined) {
		return true;
	}

	return reward.locationIds.includes(locationId);
}

function upsertRewardInListResponse(
	current: MerchantRewardsListResponse | undefined,
	reward: RewardResponse,
	locationId: string | undefined,
): MerchantRewardsListResponse | undefined {
	const matchesFilter = rewardMatchesLocationFilter(reward, locationId);

	if (current === undefined) {
		if (!matchesFilter) return undefined;

		return {
			success: true,
			data: [reward],
			meta: stubApiMeta(),
		};
	}

	const withoutDuplicate = current.data.filter((row) => row.id !== reward.id);

	if (!matchesFilter) {
		return withoutDuplicate.length === current.data.length ? current : { ...current, data: withoutDuplicate };
	}

	return {
		...current,
		data: [reward, ...withoutDuplicate],
	};
}

/** Insert or replace a reward in all organization rewards list caches (all location filters). */
export function upsertMerchantRewardInListCache(queryClient: QueryClient, orgSlug: string, reward: RewardResponse): void {
	const queries = queryClient.getQueriesData<MerchantRewardsListResponse>({ queryKey: merchantRewardsListQueryKeyPrefix(orgSlug) });

	for (const [queryKey, current] of queries) {
		const locationId = readLocationIdFromRewardsListQueryKey(queryKey);
		const next = upsertRewardInListResponse(current, reward, locationId);

		if (next !== current) {
			queryClient.setQueryData(queryKey, next);
		}
	}
}

/** Drop cached organization rewards lists so the next read refetches from the API. */
export async function invalidateMerchantRewardsListCache(queryClient: QueryClient, orgSlug: string): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: merchantRewardsListQueryKeyPrefix(orgSlug) });
}
