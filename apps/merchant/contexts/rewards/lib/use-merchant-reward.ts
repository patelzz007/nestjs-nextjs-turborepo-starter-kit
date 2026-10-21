"use client";

import { REWARDS_STALE_TIME_MS, retryTransientFailures } from "@/lib/query/query-policy";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { isNotFoundError } from "@workspace/client/lib/api/use-api";
import type { Envelope, RewardResponse } from "@workspace/shared";
import * as React from "react";

/** Where one reward stands while a page reads it. */
export type MerchantRewardState =
	| { readonly kind: "loading" }
	| { readonly kind: "failed"; readonly error: Error; readonly retry: () => void }
	| { readonly kind: "missing" }
	| { readonly kind: "ready"; readonly reward: RewardResponse };

/**
 * One of the tenant's rewards, for the reward page and its editor (`GET /t/:tenantSlug/rewards/:rewardId`),
 * seeded by the server's read (`initialReward`). A reward not offered at any of the member's stores answers 404:
 * that is "missing", not a failure to retry.
 */
export function useMerchantReward(tenantSlug: string, rewardId: string, initialReward: Envelope<RewardResponse> | undefined): MerchantRewardState {
	const { api } = useAuth();
	const rewardQuery = api.tenants.rewards.get.useQuery(
		{ tenantSlug, rewardId },
		{
			...initialDataOption(initialReward),
			staleTime: REWARDS_STALE_TIME_MS,
			retry: retryTransientFailures,
		},
	);
	const { refetch } = rewardQuery;
	const retry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);

	if (rewardQuery.isSuccess) {
		return { kind: "ready", reward: rewardQuery.data.data };
	}
	const { error } = rewardQuery;
	if (rewardQuery.isError && error !== null) {
		return isNotFoundError(error) ? { kind: "missing" } : { kind: "failed", error, retry };
	}
	return { kind: "loading" };
}

/** Whether a reward's offer may still change: only before it goes live (a draft, or one waiting for review). */
export function isRewardEditable(status: RewardResponse["status"]): boolean {
	return status === "DRAFT" || status === "PENDING_REVIEW";
}
