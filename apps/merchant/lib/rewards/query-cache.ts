import { apiRouter } from "@workspace/client/lib/api/endpoints";
import type { Envelope, RewardResponse } from "@workspace/shared";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

type MerchantRewardsListResponse = Envelope<readonly RewardResponse[]>;

const rewardsListDef = apiRouter.organizations.rewards.list;

function merchantRewardsListQueryKeyPrefix(orgSlug: string): QueryKey {
	return rewardsListDef.scopeKey({ orgSlug });
}

/** The store filter a cached rewards list was fetched for. */
interface RewardsListLocationFilter {
	/** `undefined` = every store. */
	readonly locationId: string | undefined;
}

/**
 * The store filter of a cached rewards list, read from the key's last segment —
 * the def's parsed input (`[...scope, input]`). `null` when that segment is not
 * a rewards-list input (the entry is then left untouched, never guessed at).
 */
function readLocationFilterFromRewardsListQueryKey(queryKey: QueryKey): RewardsListLocationFilter | null {
	const parsed = rewardsListDef.inputSchema.safeParse(queryKey.at(-1));
	return parsed.success ? { locationId: parsed.data.locationId } : null;
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

	// A list that has not loaded yet is left alone: it will read the reward from the API. Building an
	// envelope here would fabricate a server answer (meta) the API never sent.
	if (current === undefined) {
		return undefined;
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
		const filter = readLocationFilterFromRewardsListQueryKey(queryKey);
		if (filter === null) {
			continue;
		}
		const next = upsertRewardInListResponse(current, reward, filter.locationId);

		if (next !== current) {
			queryClient.setQueryData(queryKey, next);
		}
	}
}

/** Drop cached organization rewards lists so the next read refetches from the API. */
export async function invalidateMerchantRewardsListCache(queryClient: QueryClient, orgSlug: string): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: merchantRewardsListQueryKeyPrefix(orgSlug) });
}
