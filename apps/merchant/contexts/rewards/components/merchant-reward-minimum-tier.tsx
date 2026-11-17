"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { MinimumTierSelect, minimumTierOptionLabel } from "@workspace/client/lib/contexts/tiers";
import type { CustomerTier, RewardResponse } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import { isRewardEnded } from "@/contexts/rewards/lib/presentation";
import { applyMerchantRewardChange } from "@/contexts/rewards/lib/query-cache";

/** Whether a reward can take a minimum tier at all: one for everyone, without referrals (ADR 085). */
export function rewardTakesMinimumTier(reward: Pick<RewardResponse, "audienceType" | "referralsEnabled">): boolean {
	return reward.audienceType === "EVERYONE" && !reward.referralsEnabled;
}

export interface MerchantRewardMinimumTierProps {
	readonly tenantSlug: string;
	readonly reward: RewardResponse;
	/** The member may manage rewards. */
	readonly canManage: boolean;
}

/**
 * The reward page's minimum tier (ADR 085): who may claim it, changeable while the reward still has claims ahead —
 * published too, without another review. Claims already made stand. Read-only for an ended reward, for a reward that
 * cannot take a tier, and for members who cannot manage rewards.
 */
export function MerchantRewardMinimumTier({ tenantSlug, reward, canManage }: MerchantRewardMinimumTierProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const mutation = api.tenants.rewards.setMinimumTier.useMutation({
		onSuccess: (response): void => {
			toastMessage.success({ title: "Minimum tier saved", description: "Claims already made stay good." });
			void applyMerchantRewardChange(queryClient, tenantSlug, response);
		},
		onError: (): void => {
			toastMessage.error({ title: "Minimum tier not saved", description: "Check your connection and try again." });
		},
	});
	const { mutate } = mutation;
	const handleChange = React.useCallback(
		(minimumTier: CustomerTier): void => {
			if (minimumTier !== reward.minimumTier) {
				mutate({ tenantSlug, rewardId: reward.id, minimumTier });
			}
		},
		[mutate, reward.id, reward.minimumTier, tenantSlug],
	);

	if (!canManage || isRewardEnded(reward.status) || !rewardTakesMinimumTier(reward)) {
		return <>{minimumTierOptionLabel(reward.minimumTier)}</>;
	}
	return (
		<span className="block max-w-56">
			<MinimumTierSelect id="reward-minimum-tier" accessibleName="Minimum tier" value={reward.minimumTier} onValueChange={handleChange} disabled={mutation.isPending} />
		</span>
	);
}
