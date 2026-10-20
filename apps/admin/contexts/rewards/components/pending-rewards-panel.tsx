"use client";

import {
	initialDataOption,
	readPaginatedHasNext,
	readPaginatedHasPrevious,
	readPaginatedPage,
	readPaginatedTotal,
	readPaginatedTotalPages,
} from "@workspace/client/lib/api/envelope";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { Envelope, RewardResponse } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { CoverImage } from "@workspace/ui/components/cover-image";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import Link from "next/link";
import * as React from "react";

import { PENDING_REWARDS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { PendingRewardItemsSkeleton } from "@/components/loading/rewards-skeletons";
import { ROUTES } from "@/lib/routes";
import { REWARDS_REVIEW_URL_STATE, toPendingRewardsListQuery } from "@/contexts/rewards/url-state/rewards-review";

/** The queue draws each reward's cover as a small thumbnail (`w-20`, `sm:w-28`). */
const QUEUE_THUMBNAIL_SIZES = "7rem";

export interface PendingRewardsPanelProps {
	/** The API's own envelope (real pagination meta) of the page the server rendered, bound to that URL state. */
	readonly initialPage?: PrefetchedQuery<Envelope<RewardResponse[]>> | undefined;
}

/** What the queue shows above (or instead of) its rows — one state at a time. */
export type PendingRewardsQueueStatus = "loading" | "error" | "empty" | "ready";

/** An error without rows is shown as an error (never as "no rewards"); rows keep showing while a refetch fails. */
export function resolveQueueStatus(isError: boolean, isLoading: boolean, rowCount: number): PendingRewardsQueueStatus {
	if (rowCount > 0) {
		return "ready";
	}
	if (isError) {
		return "error";
	}
	return isLoading ? "loading" : "empty";
}

function PendingRewardsStatus({ status, onRetry }: { readonly status: PendingRewardsQueueStatus; readonly onRetry: () => void }): React.JSX.Element | null {
	switch (status) {
		case "loading":
			return (
				<SkeletonRegion labels={PENDING_REWARDS_LOADING_LABELS} className="flex flex-col gap-4">
					<PendingRewardItemsSkeleton />
				</SkeletonRegion>
			);
		case "error":
			return (
				<div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
					<span>Couldn&apos;t load the moderation queue.</span>
					<Button type="button" variant="outline" size="sm" onClick={onRetry}>
						Try again
					</Button>
				</div>
			);
		case "empty":
			return <p className="text-sm text-muted-foreground">No rewards waiting for review.</p>;
		case "ready":
			return null;
	}
}

/**
 * One reward waiting in the queue — just enough to recognise it: its cover,
 * title and merchant. Everything a decision needs is a click away, on the
 * reward's own page.
 */
function PendingRewardRow({ reward }: { readonly reward: RewardResponse }): React.JSX.Element {
	const [cover] = reward.images;
	const titleId = `pending-reward-title-${reward.id}`;
	return (
		<li>
			<article aria-labelledby={titleId} className="flex items-center gap-3 rounded-lg border p-3 sm:gap-4">
				<CoverImage src={cover?.url} sources={cover?.sources} sizes={QUEUE_THUMBNAIL_SIZES} className="w-20 shrink-0 rounded-md border sm:w-28" />
				<div className="min-w-0 flex-1 space-y-0.5">
					<h2 id={titleId} className="truncate font-medium">
						{reward.title}
					</h2>
					<p className="truncate text-sm text-muted-foreground">{reward.tenantName ?? "Merchant"}</p>
				</div>
				<Link
					href={ROUTES.rewards.reviewDetail(reward.id)}
					aria-label={`View more about ${reward.title}`}
					className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}>
					View more
				</Link>
			</article>
		</li>
	);
}

export default function PendingRewardsPanel({ initialPage }: PendingRewardsPanelProps): React.JSX.Element {
	const { api } = useAuth();

	const [urlState, updateUrlState] = useUrlState(REWARDS_REVIEW_URL_STATE);
	const stateKey: string = REWARDS_REVIEW_URL_STATE.serialize(urlState);
	const pendingQuery = api.rewardsAdmin.pendingRewards.useQuery(toPendingRewardsListQuery(urlState), initialDataOption(prefetchedDataFor(initialPage, stateKey)));

	const rewards = pendingQuery.data?.data ?? [];
	const meta = pendingQuery.data?.meta;
	// The queue's size is the server's count — a page only holds some of the rewards.
	const pendingTotal: number = readPaginatedTotal(meta);
	const currentPage: number = readPaginatedPage(meta, urlState.page);
	const totalPages: number = readPaginatedTotalPages(meta);

	const handlePreviousPage = React.useCallback((): void => {
		updateUrlState({ page: Math.max(LIST_FIRST_PAGE, urlState.page - 1), cursor: undefined });
	}, [updateUrlState, urlState.page]);

	const handleNextPage = React.useCallback((): void => {
		updateUrlState({ page: urlState.page + 1, cursor: undefined });
	}, [updateUrlState, urlState.page]);

	const { refetch } = pendingQuery;
	const handleRetry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);

	const queueStatus: PendingRewardsQueueStatus = resolveQueueStatus(pendingQuery.isError, pendingQuery.isLoading, rewards.length);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Pending rewards</h1>
				<p className="text-sm text-muted-foreground">Rewards merchants have submitted, waiting for a decision before customers can see them.</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Moderation queue ({pendingTotal})</CardTitle>
					<CardDescription>Oldest first. Open a reward to check it in full, then approve or reject it.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<PendingRewardsStatus status={queueStatus} onRetry={handleRetry} />
					{rewards.length > 0 ? (
						<ul className="flex flex-col gap-3">
							{rewards.map((reward) => (
								<PendingRewardRow key={reward.id} reward={reward} />
							))}
						</ul>
					) : null}
					{totalPages > LIST_FIRST_PAGE ? (
						<nav aria-label="Moderation queue pages" className="flex items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
							<span>
								Page {currentPage} of {totalPages}
							</span>
							<div className="flex gap-2">
								<Button type="button" size="sm" variant="outline" disabled={!readPaginatedHasPrevious(meta)} onClick={handlePreviousPage}>
									Previous
								</Button>
								<Button type="button" size="sm" variant="outline" disabled={!readPaginatedHasNext(meta)} onClick={handleNextPage}>
									Next
								</Button>
							</div>
						</nav>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
