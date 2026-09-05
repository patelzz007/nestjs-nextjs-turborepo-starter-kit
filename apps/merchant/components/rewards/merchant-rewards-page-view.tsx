"use client";

import { MerchantRewardsCatalog } from "@/components/rewards/merchant-rewards-catalog";
import { MerchantRewardsSummaryStrip } from "@/components/rewards/merchant-rewards-summary-strip";
import { MerchantEmptyState } from "@/components/merchant-ui/empty-state";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { useMerchantCapabilities } from "@/lib/merchant-capabilities";
import { stubApiMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { RewardResponse, RewardStatus } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { Gift, Plus, Sparkles, Ticket } from "lucide-react";
import Link from "next/link";
import * as React from "react";

function countByStatus(rewards: readonly RewardResponse[], status: RewardStatus): number {
	return rewards.filter((reward) => reward.status === status).length;
}

export interface MerchantRewardsPageViewProps {
	readonly initialRewards?: readonly RewardResponse[];
}

export function MerchantRewardsPageView({ initialRewards }: MerchantRewardsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { hasCapability } = useMerchantCapabilities();
	const canManageRewards = hasCapability("merchant:manage_rewards");

	const initialQueryData = React.useMemo(
		() =>
			initialRewards !== undefined
				? {
						success: true as const,
						data: [...initialRewards],
						meta: stubApiMeta(),
					}
				: undefined,
		[initialRewards],
	);

	const rewardsQuery = api.merchant.rewards.list.useQuery(
		{},
		{
			initialData: initialQueryData,
		},
	);

	const rewards: readonly RewardResponse[] = rewardsQuery.data?.data ?? [];
	const isLoading = rewardsQuery.isLoading && initialRewards === undefined;

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

	const showEmpty = !isLoading && rewards.length === 0;

	return (
		<div className="space-y-8">
			<MerchantPageHeader
				title="Rewards"
				description="Create drafts, submit for review, and monitor live inventory across your store."
				actions={
					canManageRewards ? (
						<Link href="/rewards/new" className={cn(buttonVariants(), "gap-2")}>
							<Plus className="size-4" aria-hidden="true" />
							New reward
						</Link>
					) : undefined
				}
			/>

			<MerchantRewardsSummaryStrip items={summaryItems} />

			{showEmpty ? (
				<MerchantEmptyState
					title="No rewards yet"
					description="Start with a draft offer — you can refine details and submit for review before it goes live."
					icon={<Ticket className="size-5" aria-hidden="true" />}
					action={
						canManageRewards ? (
							<Link href="/rewards/new" className={cn(buttonVariants(), "gap-2")}>
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
