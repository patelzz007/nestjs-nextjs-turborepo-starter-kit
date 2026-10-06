"use client";

import { MerchantCapabilityGate, MerchantReadOnlyNotice } from "@/components/access/merchant-capability-gate";
import { MerchantRewardsCatalog } from "@/components/rewards/merchant-rewards-catalog";
import { MerchantRewardsSummaryStrip } from "@/components/rewards/merchant-rewards-summary-strip";
import { MerchantEmptyState } from "@/components/merchant-ui/empty-state";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { useMerchantLocation } from "@/features/tenant-context/facade";
import { orgRoutes } from "@/lib/routes";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { REWARDS_STALE_TIME_MS, retryTransientFailures, userSafeErrorMessage } from "@/lib/query/query-policy";
import { MERCHANT_CAPABILITY, PLATFORM_DISPLAY_REGION, type RewardResponse, type RewardStatus } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatCount } from "@workspace/ui/lib/format/number";
import { AlertCircle, Gift, Plus, Sparkles, Ticket } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const REWARDS_LOAD_FAILED_MESSAGE = "The rewards catalog failed to load. Try again.";

function countByStatus(rewards: readonly RewardResponse[], status: RewardStatus): number {
	return rewards.filter((reward) => reward.status === status).length;
}

export interface MerchantRewardsPageViewProps {
	readonly orgSlug: string;
}

/** Rewards catalog route — requires `merchant:view_rewards` (list endpoint); create CTAs need `merchant:manage_rewards`. */
export function MerchantRewardsPageView({ orgSlug }: MerchantRewardsPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.viewRewards}>
			<MerchantRewardsPageContent orgSlug={orgSlug} />
		</MerchantCapabilityGate>
	);
}

function MerchantRewardsPageContent({ orgSlug }: MerchantRewardsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const createRewardPath = orgRoutes(orgSlug).rewards.new;
	const { locationId, isLoading: isLocationLoading } = useMerchantLocation();
	const canManageRewards = can(MERCHANT_CAPABILITY.manageRewards);

	const rewardsQuery = api.organizations.rewards.list.useQuery(
		{ orgSlug, locationId },
		{
			enabled: orgSlug.length > 0 && !isLocationLoading,
			// Cached like every other list: mutations on the edit/create pages update or invalidate it.
			staleTime: REWARDS_STALE_TIME_MS,
			retry: retryTransientFailures,
		},
	);

	const rewards: readonly RewardResponse[] = rewardsQuery.isSuccess ? rewardsQuery.data.data : [];
	const isLoading = isLocationLoading || rewardsQuery.isPending || (rewardsQuery.isFetching && !rewardsQuery.isSuccess);
	const showError = rewardsQuery.isError;
	const showEmpty = rewardsQuery.isSuccess && rewards.length === 0;
	// A user-facing message for the failure (never the raw transport error text).
	const loadErrorMessage = rewardsQuery.error === null ? "" : userSafeErrorMessage(rewardsQuery.error, REWARDS_LOAD_FAILED_MESSAGE);

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
				value: formatCount(totalRemaining, PLATFORM_DISPLAY_REGION.locale),
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

			{canManageRewards ? null : <MerchantReadOnlyNotice>Your role can view rewards but not create, edit, or submit them for review.</MerchantReadOnlyNotice>}

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
