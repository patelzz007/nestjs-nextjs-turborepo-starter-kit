"use client";

import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { MerchantRewardCard } from "@/contexts/rewards/components/merchant-reward-card";
import { MerchantRewardListRow, REWARD_LIST_COLUMNS_CLASS } from "@/contexts/rewards/components/merchant-reward-list-row";
import { REWARD_STATUS_GROUPS, RewardStatusGroupIdSchema, type RewardStatusGroup, type RewardStatusGroupId } from "@/contexts/rewards/lib/presentation";
import { RewardsViewToggle, type RewardsViewToggleLabels } from "@workspace/client/lib/features/ui-preferences/rewards-view-toggle";
import { useRewardsViewMode, useUiPreferencesCommands, type RewardsViewMode } from "@workspace/client/lib/features/ui-preferences/facade";
import { PLATFORM_DISPLAY_REGION, type RewardResponse } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type { StatusTone } from "@workspace/ui/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatCount } from "@workspace/ui/lib/format/number";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { Archive, FilePen, Hourglass, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const VIEW_TOGGLE_LABELS: RewardsViewToggleLabels = { group: "Rewards layout", grid: "Grid view", list: "List view" };

export interface MerchantRewardsCatalogProps {
	/** Every status tab with its count over the whole catalog (the summary). */
	readonly groups: readonly RewardStatusGroup[];
	/** The open tab (URL state, owned by the page). */
	readonly selectedGroupId: RewardStatusGroupId;
	readonly onSelectGroup: (groupId: RewardStatusGroupId) => void;
	/** The open tab's current page of rewards. */
	readonly rewards: readonly RewardResponse[];
	/** The catalog's figures are loading: the whole catalog draws its bones. */
	readonly isLoading: boolean;
	/** The open tab's page is loading (its tabs are already known). */
	readonly isPageLoading: boolean;
	/** Shown when the page in the URL is past the tab's last page (a reward on it moved tabs). */
	readonly pastEndAction: React.ReactNode;
	/** The pager under the tab's rewards, when the tab has more than one page. */
	readonly pager: React.ReactNode;
	readonly canManageRewards: boolean;
	/** Where "Create a reward" in an empty tab leads (shown only to members who can manage rewards). */
	readonly createRewardHref: string;
}

/** List rows drawn while the catalog loads. */
const SKELETON_LIST_ROWS = 4;
/** Grid cards drawn while the catalog loads — two full rows of the widest grid. */
const SKELETON_GRID_CARDS = 6;
/** Reward-title widths, so the placeholder rewards read as different offers. */
const TITLE_WIDTHS: readonly string[] = ["w-3/4", "w-1/2", "w-2/3", "w-3/5"];

/** The grid of reward cards — the skeleton draws the same columns. */
const GRID_CLASS = "grid gap-5 sm:grid-cols-2 xl:grid-cols-3";

/** The dot before a tab's label reads like the status badges of the rewards in it (and like the sidebar's section dots). */
const STATUS_DOT_CLASS: Readonly<Record<StatusTone, string>> = {
	success: "bg-success",
	warning: "bg-warning",
	danger: "bg-destructive",
	info: "bg-info",
	neutral: "bg-foreground/50",
	muted: "bg-muted-foreground/60",
};

/** What the catalog announces while it loads. */
export const REWARDS_CATALOG_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading rewards…" };

function titleWidth(index: number): string {
	return TITLE_WIDTHS[index % TITLE_WIDTHS.length] ?? "w-2/3";
}

/** Label widths of the tab bones, so the placeholder bar reads like the real tabs. */
const TAB_LABEL_WIDTH: Readonly<Record<RewardStatusGroupId, string>> = { live: "w-7", review: "w-16", drafts: "w-11", ended: "w-11" };

/** Every tab's height: 44px touch targets on phones, the toolbar's 40px from `sm` up. */
const TAB_HEIGHT_CLASS = "h-11 sm:h-10";

/** "Live, 3 rewards" — what a screen reader says for a tab (the visual count is a bare number). */
function tabAccessibleName(group: RewardStatusGroup): string {
	return `${group.title}, ${rewardCountLabel(group.count)}`;
}

function rewardCountLabel(count: number): string {
	return `${formatCount(count, PLATFORM_DISPLAY_REGION.locale)} reward${count === 1 ? "" : "s"}`;
}

export interface MerchantRewardsCatalogSkeletonProps {
	readonly viewMode: RewardsViewMode;
}

interface CatalogToolbarProps {
	/** The status tabs (or their bones). */
	readonly tabs: React.ReactNode;
	/** The layout switch (or its bone), pinned to the end of the bar. */
	readonly end: React.ReactNode;
	/** The open tab: whenever it changes, the bar scrolls it into view (a shared `?status=ended` link on a phone). */
	readonly selectedKey?: string;
}

/** Room left beside a tab scrolled into view — the width of the bar's edge fade, so the tab lands clear of it. */
const TAB_REVEAL_MARGIN_PX = 32;

/** Scrolls the bar sideways (never the page) until its selected tab is fully visible. */
function revealSelectedTab(bar: HTMLElement): void {
	const tab = bar.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
	if (tab === null) return;
	const barBox = bar.getBoundingClientRect();
	const tabBox = tab.getBoundingClientRect();
	if (tabBox.right > barBox.right) {
		bar.scrollLeft += tabBox.right - barBox.right + TAB_REVEAL_MARGIN_PX;
	} else if (tabBox.left < barBox.left) {
		bar.scrollLeft -= barBox.left - tabBox.left + TAB_REVEAL_MARGIN_PX;
	}
}

/**
 * The bar above the rewards: the status tabs on a hairline, the layout switch
 * at its end. On a phone the tabs scroll sideways inside the bar (the page
 * never does), fading out at the edge so the cut reads as "more", while the
 * switch stays put.
 */
function CatalogToolbar({ tabs, end, selectedKey }: CatalogToolbarProps): React.JSX.Element {
	const barRef = React.useRef<HTMLDivElement>(null);
	React.useEffect((): void => {
		if (barRef.current !== null) revealSelectedTab(barRef.current);
	}, [selectedKey]);

	return (
		<div data-slot="rewards-toolbar" className="flex items-center gap-3 border-b border-border">
			<div
				ref={barRef}
				className="-mb-px min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [&::-webkit-scrollbar]:hidden">
				{tabs}
			</div>
			<div className="shrink-0 pb-1.5">{end}</div>
		</div>
	);
}

/** The tab bar's bones: dot, label and count per status group. */
function RewardStatusTabsSkeleton(): React.JSX.Element {
	return (
		<div data-slot="rewards-tabs-skeleton" className="flex items-center gap-1 sm:gap-2">
			{REWARD_STATUS_GROUPS.map((group): React.JSX.Element => (
				<div key={group.id} className={cn("flex shrink-0 items-center gap-2 px-3", TAB_HEIGHT_CLASS)}>
					<Skeleton className="size-1.5 rounded-full" />
					<Skeleton variant="text" className={cn("h-3.5", TAB_LABEL_WIDTH[group.id])} />
					<Skeleton className="h-5 w-6 rounded-full" />
				</div>
			))}
		</div>
	);
}

/**
 * The catalog's whole silhouette — the tab bar with its layout switch, then
 * the rewards in the member's layout — for the route's loading skeleton. Bones
 * only: wrap it in one `SkeletonRegion`.
 */
export function MerchantRewardsCatalogSkeleton({ viewMode }: MerchantRewardsCatalogSkeletonProps): React.JSX.Element {
	return (
		<div data-slot="rewards-catalog-skeleton" className="flex flex-col gap-5">
			<CatalogToolbar tabs={<RewardStatusTabsSkeleton />} end={<Skeleton className="h-8 w-18 rounded-md" />} />
			<RewardsBodySkeleton viewMode={viewMode} />
		</div>
	);
}

/**
 * The rewards' silhouette in the member's layout: voucher cards (cover,
 * category and status, offer, title, description, tear line, stock, activity,
 * stores and end date) or list rows (cover thumbnail, then the list's columns).
 */
function RewardsBodySkeleton({ viewMode }: MerchantRewardsCatalogSkeletonProps): React.JSX.Element {
	if (viewMode === "list") {
		return (
			<div data-slot="rewards-list-skeleton" className="flex flex-col gap-3">
				{placeholderKeys("reward", SKELETON_LIST_ROWS).map((key, index): React.JSX.Element => (
					<div key={key} className={cn("grid gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-xs lg:px-5", REWARD_LIST_COLUMNS_CLASS)}>
						<Skeleton className="row-span-4 aspect-4/3 w-full self-start rounded-lg lg:row-span-1 lg:self-center" />
						<Skeleton variant="text" className="col-start-2 h-5 w-20 lg:col-start-auto" />
						<div className="col-start-2 flex min-w-0 flex-col gap-2 lg:col-start-auto">
							<Skeleton variant="text" className={cn("h-4", titleWidth(index))} />
							<Skeleton variant="text" className="h-3.5 w-4/5" />
							<Skeleton variant="text" className="h-3 w-32" />
						</div>
						<Skeleton className="hidden h-5 w-14 rounded-full lg:block" />
						<div className="col-start-2 flex flex-col gap-1.5 lg:col-start-auto">
							<Skeleton variant="text" className="h-3 w-20" />
							<Skeleton className="h-1.5 w-full rounded-full" />
						</div>
						<div className="hidden flex-col gap-1.5 lg:flex">
							<Skeleton variant="text" className="h-3 w-16" />
							<Skeleton variant="text" className="h-3 w-20" />
						</div>
						<Skeleton variant="text" className="hidden h-3 w-20 justify-self-end lg:block" />
					</div>
				))}
			</div>
		);
	}

	return (
		<div data-slot="rewards-grid-skeleton" className={GRID_CLASS}>
			{placeholderKeys("reward", SKELETON_GRID_CARDS).map((key, index): React.JSX.Element => (
				<div key={key} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
					<Skeleton className="aspect-video w-full rounded-none" />
					<div className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-5">
						<div className="flex items-center justify-between gap-3">
							<Skeleton variant="text" className="h-3 w-16" />
							<Skeleton className="h-5 w-12 rounded-full" />
						</div>
						<div className="flex flex-col gap-2">
							<Skeleton variant="text" className="h-7 w-28" />
							<Skeleton variant="text" className={cn("mt-1 h-4.5", titleWidth(index))} />
							<Skeleton variant="text" className="h-3.5 w-full" />
							<Skeleton variant="text" className="h-3.5 w-2/3" />
						</div>
					</div>
					<div className="flex flex-col gap-3.5 px-5 pb-4">
						<div className="-mx-2 border-t-[1.5px] border-dashed border-border" />
						<div className="flex flex-col gap-1.5">
							<Skeleton variant="text" className="h-3 w-20" />
							<Skeleton className="h-1.5 w-full rounded-full" />
						</div>
						<Skeleton variant="text" className="h-3.5 w-36" />
						<div className="flex items-center justify-between gap-3">
							<Skeleton variant="text" className="h-3 w-24" />
							<Skeleton variant="text" className="h-3 w-20" />
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

interface EmptyTabCopy {
	readonly title: string;
	readonly description: string;
	readonly icon: React.ReactNode;
}

/** What an empty tab says: what lands there, and how. */
const EMPTY_TAB_COPY: Readonly<Record<RewardStatusGroupId, EmptyTabCopy>> = {
	live: {
		title: "No live rewards",
		description: "Rewards show here once they are approved and published. Customers can only claim a reward while it is live.",
		icon: <Sparkles className="size-5" aria-hidden="true" />,
	},
	review: {
		title: "Nothing waiting for review",
		description: "When you submit a draft for review, it waits here until it is approved and goes live.",
		icon: <Hourglass className="size-5" aria-hidden="true" />,
	},
	drafts: {
		title: "No drafts",
		description: "Rewards you start but have not submitted for review are kept here, so you can finish them later.",
		icon: <FilePen className="size-5" aria-hidden="true" />,
	},
	ended: {
		title: "No ended rewards",
		description: "Rewards move here when they expire or are turned off. Nothing has ended yet.",
		icon: <Archive className="size-5" aria-hidden="true" />,
	},
};

interface EmptyTabProps {
	readonly group: RewardStatusGroup;
	readonly action: React.ReactNode;
}

function EmptyTab({ group, action }: EmptyTabProps): React.JSX.Element {
	const copy = EMPTY_TAB_COPY[group.id];
	return (
		<Empty className="border bg-card py-14">
			<EmptyHeader>
				<EmptyMedia variant="icon">{copy.icon}</EmptyMedia>
				<EmptyTitle role="heading" aria-level={2}>
					{copy.title}
				</EmptyTitle>
				<EmptyDescription>{copy.description}</EmptyDescription>
			</EmptyHeader>
			{action === null || action === undefined ? null : <EmptyContent>{action}</EmptyContent>}
		</Empty>
	);
}

interface RewardStatusTabProps {
	readonly group: RewardStatusGroup;
}

/** One tab: the group's tone dot, its title and how many rewards it holds. */
function RewardStatusTab({ group }: RewardStatusTabProps): React.JSX.Element {
	const { count } = group;
	return (
		<TabsTrigger
			value={group.id}
			aria-label={tabAccessibleName(group)}
			data-group={group.id}
			className={cn(
				"group/tab flex-none gap-2 rounded-md px-3 font-medium hover:bg-muted/60 focus-visible:ring-inset",
				TAB_HEIGHT_CLASS,
				"after:rounded-full after:bg-primary group-data-horizontal/tabs:after:inset-x-2 group-data-horizontal/tabs:after:bottom-0",
			)}>
			<span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT_CLASS[group.tone])} />
			{group.title}
			<span
				aria-hidden="true"
				className={cn(
					"inline-flex h-5 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums transition-colors",
					"group-data-active/tab:bg-primary group-data-active/tab:text-primary-foreground",
					count === 0 && "opacity-70",
				)}>
				{formatCount(count, PLATFORM_DISPLAY_REGION.locale)}
			</span>
		</TabsTrigger>
	);
}

interface RewardStatusPanelProps {
	readonly group: RewardStatusGroup;
	readonly rewards: readonly RewardResponse[];
	readonly viewMode: RewardsViewMode;
	readonly canManageRewards: boolean;
	readonly emptyAction: React.ReactNode;
	readonly pastEndAction: React.ReactNode;
}

/** One tab's page of rewards, as voucher cards or list rows — or what will appear there. */
function RewardStatusPanel({ group, rewards, viewMode, canManageRewards, emptyAction, pastEndAction }: RewardStatusPanelProps): React.JSX.Element {
	if (group.count === 0) {
		return <EmptyTab group={group} action={emptyAction} />;
	}
	if (rewards.length === 0) {
		return (
			<Empty className="border bg-card py-14">
				<EmptyHeader>
					<EmptyTitle role="heading" aria-level={2}>
						No rewards on this page
					</EmptyTitle>
					<EmptyDescription>This page is past the end of the tab.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>{pastEndAction}</EmptyContent>
			</Empty>
		);
	}
	if (viewMode === "grid") {
		return (
			<div className={GRID_CLASS}>
				{rewards.map((reward) => (
					<MerchantRewardCard key={reward.id} reward={reward} canManageRewards={canManageRewards} />
				))}
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-3">
			<div aria-hidden="true" className={cn("hidden px-5 text-xs text-muted-foreground lg:grid", REWARD_LIST_COLUMNS_CLASS)}>
				<span>Cover</span>
				<span>Offer</span>
				<span>Reward</span>
				<span>Status</span>
				<span>Inventory</span>
				<span>Activity</span>
				<span className="text-end">Ends</span>
			</div>
			{rewards.map((reward) => (
				<MerchantRewardListRow key={reward.id} reward={reward} canManageRewards={canManageRewards} />
			))}
		</div>
	);
}

/**
 * Rewards in one tab per status (live, in review, drafts, ended), as voucher
 * cards or list rows, one page at a time. Presentational: the page owns the
 * open tab and its page (URL state) and fetches them; this draws the tabs with
 * their counts, the open tab's rewards and the pager it is given.
 */
export function MerchantRewardsCatalog({
	groups,
	selectedGroupId,
	onSelectGroup: selectGroup,
	rewards,
	isLoading,
	isPageLoading,
	pastEndAction,
	pager,
	canManageRewards,
	createRewardHref,
}: MerchantRewardsCatalogProps): React.JSX.Element {
	const viewMode = useRewardsViewMode();
	const { changeRewardsViewMode } = useUiPreferencesCommands();

	const handleTabChange = React.useCallback(
		(value: string | null): void => {
			const parsed = RewardStatusGroupIdSchema.safeParse(value);
			if (parsed.success) {
				selectGroup(parsed.data);
			}
		},
		[selectGroup],
	);

	const openDrafts = React.useCallback((): void => {
		selectGroup("drafts");
	}, [selectGroup]);

	const hasDrafts = groups.some((group) => group.id === "drafts" && group.count > 0);
	const emptyActionFor = (groupId: RewardStatusGroupId): React.ReactNode => {
		if (groupId === "review" && hasDrafts) {
			return (
				<Button type="button" variant="outline" onClick={openDrafts}>
					Open drafts
				</Button>
			);
		}
		if (!canManageRewards || groupId === "ended") {
			return undefined;
		}
		return (
			<Link href={createRewardHref} className={cn(buttonVariants(), "gap-2")}>
				<Plus className="size-4" aria-hidden="true" />
				Create a reward
			</Link>
		);
	};

	const viewToggle = <RewardsViewToggle viewMode={viewMode} onViewModeChange={changeRewardsViewMode} labels={VIEW_TOGGLE_LABELS} />;

	if (isLoading) {
		return (
			<section className="flex flex-col gap-5" aria-label="Rewards catalog">
				<CatalogToolbar
					tabs={
						<div aria-hidden="true">
							<RewardStatusTabsSkeleton />
						</div>
					}
					end={viewToggle}
				/>
				<SkeletonRegion labels={REWARDS_CATALOG_LOADING_LABELS}>
					<RewardsBodySkeleton viewMode={viewMode} />
				</SkeletonRegion>
			</section>
		);
	}

	return (
		<section aria-label="Rewards catalog">
			<Tabs value={selectedGroupId} onValueChange={handleTabChange} className="gap-5">
				<CatalogToolbar
					selectedKey={selectedGroupId}
					tabs={
						<TabsList variant="line" aria-label="Reward status" className="h-auto justify-start gap-1 p-0 group-data-horizontal/tabs:h-auto max-sm:pe-8 sm:gap-2">
							{groups.map((group) => (
								<RewardStatusTab key={group.id} group={group} />
							))}
						</TabsList>
					}
					end={viewToggle}
				/>
				{groups.map((group) => (
					<TabsContent key={group.id} value={group.id} data-group={group.id} className="flex flex-col gap-5 text-base">
						{group.id !== selectedGroupId ? null : isPageLoading ? (
							<SkeletonRegion labels={REWARDS_CATALOG_LOADING_LABELS}>
								<RewardsBodySkeleton viewMode={viewMode} />
							</SkeletonRegion>
						) : (
							<>
								<RewardStatusPanel
									group={group}
									rewards={rewards}
									viewMode={viewMode}
									canManageRewards={canManageRewards}
									emptyAction={emptyActionFor(group.id)}
									pastEndAction={pastEndAction}
								/>
								{pager}
							</>
						)}
					</TabsContent>
				))}
			</Tabs>
		</section>
	);
}
