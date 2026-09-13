"use client";

import { MerchantRewardsCatalog } from "@/components/rewards/merchant-rewards-catalog";
import { MerchantRewardsSummaryStrip } from "@/components/rewards/merchant-rewards-summary-strip";
import { MerchantEmptyState } from "@/components/merchant-ui/empty-state";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { useMerchantCapabilities } from "@/lib/org/capabilities";
import { useMerchantLocation } from "@/lib/org/location-context";
import { organizationPath } from "@/lib/org/slug";
import { useAuth } from "@workspace/client/lib/auth";
import type { RewardResponse, RewardStatus } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { AlertCircle, Gift, Plus, Sparkles, Ticket } from "lucide-react";
import Link from "next/link";
import * as React from "react";

function countByStatus(rewards: readonly RewardResponse[], status: RewardStatus): number {
	return rewards.filter((reward) => reward.status === status).length;
}

export interface MerchantRewardsPageViewProps {
	readonly orgSlug: string;
}

export function MerchantRewardsPageView({ orgSlug }: MerchantRewardsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const createRewardPath = organizationPath(orgSlug, "rewards/new");
	const { hasCapability } = useMerchantCapabilities();
	const { locationId, isLoading: isLocationLoading } = useMerchantLocation();
	const canManageRewards = hasCapability("merchant:manage_rewards");

	const rewardsQuery = api.organizations.rewards.list.useQuery(
		{ orgSlug, locationId },
		{
			enabled: orgSlug.length > 0 && !isLocationLoading,
			staleTime: 0,
			gcTime: 0,
			refetchOnMount: "always",
			retry: 1,
		},
	);

	const rewards: readonly RewardResponse[] = rewardsQuery.isSuccess ? rewardsQuery.data.data : [];
	const isLoading = isLocationLoading || rewardsQuery.isPending || (rewardsQuery.isFetching && !rewardsQuery.isSuccess);
	const showError = rewardsQuery.isError;
	const showEmpty = rewardsQuery.isSuccess && rewards.length === 0;
	const loadErrorMessage = rewardsQuery.error instanceof Error ? rewardsQuery.error.message : "The rewards catalog failed to load. Try again.";

	const handleRetry = React.useCallback((): void => {
		void rewardsQuery.refetch();
	}, [rewardsQuery]);

	const liveCount = countByStatus(rewards, "PUBLISHED");
	const draftCount = countByStatus(rewards, "DRAFT") + countByStatus(rewards, "PENDING_REVIEW");
	const totalRemaining = rewards.reduce((sum, reward) => sum + reward.quantityRemaining, 0);

	const summaryItems = React.useMemo(
		() => [
			{
				label: "Live offers",
				value: String(liveCount),
				hint: "Published and redeemable",
				icon: <Sparkles className="size-4" aria-hidden="true" />,
			},
			{
				label: "In pipeline",
				value: String(draftCount),
				hint: "Drafts and in review",
				icon: <Ticket className="size-4" aria-hidden="true" />,
			},
			{
				label: "Units left",
				value: totalRemaining.toLocaleString(),
				hint: "Across all rewards",
				icon: <Gift className="size-4" aria-hidden="true" />,
			},
		],
		[draftCount, liveCount, totalRemaining],
	);

	return (
		<div className="space-y-8">
			<MerchantPageHeader
				title="Rewards"
				description="Create drafts, submit for review, and monitor live inventory across your store."
				actions={
					canManageRewards ? (
						<Link href={createRewardPath} className={cn(buttonVariants(), "gap-2")}>
							<Plus className="size-4" aria-hidden="true" />
							New reward
						</Link>
					) : undefined
				}
			/>

			<MerchantRewardsSummaryStrip items={summaryItems} />

			{showError ? (
				<MerchantEmptyState
					title="Could not load rewards"
					description={loadErrorMessage}
					icon={<AlertCircle className="size-5" aria-hidden="true" />}
					action={
						<Button type="button" onClick={handleRetry}>
							Retry
						</Button>
					}
				/>
			) : showEmpty ? (
				<MerchantEmptyState
					title="No rewards yet"
					description="Start with a draft offer — you can refine details and submit for review before it goes live."
					icon={<Ticket className="size-5" aria-hidden="true" />}
					action={
						canManageRewards ? (
							<Link href={createRewardPath} className={cn(buttonVariants(), "gap-2")}>
								<Plus className="size-4" aria-hidden="true" />
								Create first reward
							</Link>
						) : undefined
					}
				/>
			) : (
				<MerchantRewardsCatalog rewards={rewards} isLoading={isLoading} canManageRewards={canManageRewards} />
			)}
		</div>
	);
}
