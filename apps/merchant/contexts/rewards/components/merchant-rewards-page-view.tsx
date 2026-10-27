"use client";

import { MerchantCapabilityGate, MerchantReadOnlyNotice } from "@/contexts/tenancy";
import { MerchantRewardsPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import { MerchantRewardsCatalog } from "@/contexts/rewards/components/merchant-rewards-catalog";
import { MerchantRewardsSummaryStrip, MerchantRewardsSummaryStripSkeleton } from "@/contexts/rewards/components/merchant-rewards-summary-strip";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { useMerchantLocation } from "@/features/tenant-context/facade";
import { tenantRoutes } from "@/lib/routes";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { REWARDS_STALE_TIME_MS, retryTransientFailures, userSafeErrorMessage } from "@/lib/query/query-policy";
import { defaultRewardStatusGroupId, groupStatusCounts, type RewardStatusGroupId } from "@/contexts/rewards/lib/presentation";
import { REWARDS_URL_STATE, rewardsTabPatch, toRewardsQuery } from "@/contexts/rewards/url-state/rewards";
import { useUrlListPager } from "@workspace/client/lib/url-state/use-url-list-pager";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { useIsOtherViewPlaceholder } from "@workspace/client/lib/url-state/use-view-placeholder";
import { MERCHANT_CAPABILITY, PLATFORM_DISPLAY_REGION, type RewardResponse } from "@workspace/shared";
import { ListPager } from "@workspace/ui/components/list-pager";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { keepPreviousData } from "@tanstack/react-query";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatCount } from "@workspace/ui/lib/format/number";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { AlertCircle, Gift, Plus, Sparkles, Ticket } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const REWARDS_LOAD_FAILED_MESSAGE = "The rewards catalog failed to load. Try again.";

const PAGER_LABELS: UiKitLabelsOverride<"listPager"> = { ariaLabel: "Reward pages" };

export interface MerchantRewardsPageViewProps {
	readonly tenantSlug: string;
}

/** Rewards catalog route — requires `merchant:view_rewards` (list endpoint); create CTAs need `merchant:manage_rewards`. */
export function MerchantRewardsPageView({ tenantSlug }: MerchantRewardsPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.viewRewards} loading={<MerchantRewardsPageSkeleton />}>
			<MerchantRewardsPageContent tenantSlug={tenantSlug} />
		</MerchantCapabilityGate>
	);
}

function MerchantRewardsPageContent({ tenantSlug }: MerchantRewardsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const createRewardPath = tenantRoutes(tenantSlug).rewards.new;
	const { locationId, isLoading: isLocationLoading } = useMerchantLocation();
	const canManageRewards = can(MERCHANT_CAPABILITY.manageRewards);

	// The catalog's figures over every reward in the store scope: the tab counts and the summary strip.
	const summaryQuery = api.tenants.rewards.summary.useQuery(
		{ tenantSlug, locationId },
		{ enabled: tenantSlug.length > 0 && !isLocationLoading, staleTime: REWARDS_STALE_TIME_MS, retry: retryTransientFailures },
	);
	const summary = summaryQuery.data?.data;
	const groups = React.useMemo(() => (summary === undefined ? [] : groupStatusCounts(summary.countsByStatus)), [summary]);

	// The open tab and its page are URL state; without a tab in the URL the catalog opens on the first one with rewards.
	const [urlState, updateUrlState] = useUrlState(REWARDS_URL_STATE);
	const selectedGroupId: RewardStatusGroupId = urlState.status ?? defaultRewardStatusGroupId(groups);
	const rewardsQuery = api.tenants.rewards.list.useQuery(toRewardsQuery(tenantSlug, locationId, urlState, selectedGroupId), {
		// The default tab depends on the figures: wait for them unless the URL names the tab.
		enabled: tenantSlug.length > 0 && !isLocationLoading && (urlState.status !== undefined || summaryQuery.isSuccess),
		// Cached like every other list: mutations on the edit/create pages invalidate it.
		staleTime: REWARDS_STALE_TIME_MS,
		retry: retryTransientFailures,
		placeholderData: keepPreviousData,
	});
	const pager = useUrlListPager(urlState, updateUrlState, rewardsQuery.data?.meta);
	const selectGroup = React.useCallback(
		(groupId: RewardStatusGroupId): void => {
			updateUrlState(rewardsTabPatch(groupId));
		},
		[updateUrlState],
	);
	// A tab the pointer or keyboard focus reaches is fetched ahead, so opening it shows its rewards at once.
	const prefetchRewards = api.tenants.rewards.list.usePrefetch({ staleTime: REWARDS_STALE_TIME_MS });
	const warmGroup = React.useCallback(
		(groupId: RewardStatusGroupId): void => {
			if (groupId !== selectedGroupId && tenantSlug.length > 0 && !isLocationLoading) {
				prefetchRewards(toRewardsQuery(tenantSlug, locationId, { ...urlState, ...rewardsTabPatch(groupId) }, groupId));
			}
		},
		[isLocationLoading, locationId, prefetchRewards, selectedGroupId, tenantSlug, urlState],
	);

	// The previous page stays on screen while paging one tab, never under another tab.
	const isOtherTabsPage = useIsOtherViewPlaceholder(selectedGroupId, rewardsQuery);
	const rewards: readonly RewardResponse[] = rewardsQuery.isSuccess && !isOtherTabsPage ? rewardsQuery.data.data : [];
	const isLoading = isLocationLoading || summaryQuery.isPending;
	const isPageLoading = rewardsQuery.isPending || isOtherTabsPage || (rewardsQuery.isFetching && !rewardsQuery.isSuccess);
	const loadError = summaryQuery.error ?? rewardsQuery.error;
	const showError = loadError !== null;
	const catalogSize = summary === undefined ? 0 : Object.values(summary.countsByStatus).reduce((sum, count) => sum + count, 0);
	const showEmpty = summaryQuery.isSuccess && catalogSize === 0;
	// A user-facing message for the failure (never the raw transport error text).
	const loadErrorMessage = loadError === null ? "" : userSafeErrorMessage(loadError, REWARDS_LOAD_FAILED_MESSAGE);

	const handleRetry = React.useCallback((): void => {
		void summaryQuery.refetch();
		void rewardsQuery.refetch();
	}, [rewardsQuery, summaryQuery]);

	const liveCount = summary?.countsByStatus.PUBLISHED ?? 0;
	const draftCount = (summary?.countsByStatus.DRAFT ?? 0) + (summary?.countsByStatus.PENDING_REVIEW ?? 0);
	const totalRemaining = summary?.unitsRemaining ?? 0;

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

			{isLoading ? (
				// Figures of a catalog not loaded yet would read as zeros; the catalog's region below announces the load.
				<div aria-hidden="true">
					<MerchantRewardsSummaryStripSkeleton />
				</div>
			) : (
				<MerchantRewardsSummaryStrip items={summaryItems} />
			)}

			{showError ? (
				<Empty className="border bg-card">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<AlertCircle className="size-5" aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle role="heading" aria-level={2}>
							Could not load rewards
						</EmptyTitle>
						<EmptyDescription>{loadErrorMessage}</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button type="button" onClick={handleRetry}>
							Retry
						</Button>
					</EmptyContent>
				</Empty>
			) : showEmpty ? (
				<Empty className="border bg-card">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Ticket className="size-5" aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle role="heading" aria-level={2}>
							No rewards yet
						</EmptyTitle>
						<EmptyDescription>Start with a draft offer — you can refine details and submit for review before it goes live.</EmptyDescription>
					</EmptyHeader>
					{canManageRewards ? (
						<EmptyContent>
							<Link href={createRewardPath} className={cn(buttonVariants(), "gap-2")}>
								<Plus className="size-4" aria-hidden="true" />
								Create first reward
							</Link>
						</EmptyContent>
					) : null}
				</Empty>
			) : (
				<MerchantRewardsCatalog
					groups={groups}
					selectedGroupId={selectedGroupId}
					onSelectGroup={selectGroup}
					onWarmGroup={warmGroup}
					rewards={rewards}
					isLoading={isLoading}
					isPageLoading={isPageLoading}
					pastEndAction={
						<Button type="button" onClick={pager.onFirstPage}>
							Go to the first page
						</Button>
					}
					pager={
						pager.isPaged ? (
							<ListPager
								page={pager.page}
								totalPages={pager.totalPages}
								hasPrevious={pager.hasPrevious}
								hasNext={pager.hasNext}
								onPrevious={pager.onPrevious}
								onNext={pager.onNext}
								disabled={rewardsQuery.isPlaceholderData}
								labels={PAGER_LABELS}
							/>
						) : null
					}
					canManageRewards={canManageRewards}
					createRewardHref={createRewardPath}
				/>
			)}
		</div>
	);
}
