"use client";

import { REWARDS_STALE_TIME_MS, retryTransientFailures } from "@/lib/query/query-policy";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { Envelope, RewardResponse } from "@workspace/shared";
import * as React from "react";

/** Where one reward stands while a page reads it. */
export type MerchantRewardState =
	| { readonly kind: "loading" }
	| { readonly kind: "failed"; readonly error: Error; readonly retry: () => void }
	| { readonly kind: "missing" }
	| { readonly kind: "ready"; readonly reward: RewardResponse };

/**
 * One of the organization's rewards, for the reward page and its editor.
 *
 * The API has no merchant reward-detail endpoint yet, so the reward is read
 * out of the organization's reward list — seeded by the server (`initialRewards`)
 * and cached, so opening a reward from the catalog never fetches twice.
 */
export function useMerchantReward(orgSlug: string, rewardId: string, initialRewards: Envelope<RewardResponse[]> | undefined): MerchantRewardState {
	const { api } = useAuth();
	const rewardsQuery = api.organizations.rewards.list.useQuery(
		{ orgSlug },
		{
			...initialDataOption(initialRewards),
			staleTime: REWARDS_STALE_TIME_MS,
			retry: retryTransientFailures,
		},
	);
	const { refetch } = rewardsQuery;
	const retry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);

	const reward = rewardsQuery.data?.data.find((row) => row.id === rewardId);
	if (reward !== undefined) {
		return { kind: "ready", reward };
	}
	if (rewardsQuery.isLoading || rewardsQuery.isFetching) {
		return { kind: "loading" };
	}
	const { error } = rewardsQuery;
	if (rewardsQuery.isError && error !== null) {
		return { kind: "failed", error, retry };
	}
	return { kind: "missing" };
}

/** Whether a reward's offer may still change: only before it goes live (a draft, or one waiting for review). */
export function isRewardEditable(status: RewardResponse["status"]): boolean {
	return status === "DRAFT" || status === "PENDING_REVIEW";
}
