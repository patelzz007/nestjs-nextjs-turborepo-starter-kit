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
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/auth";
import type { Envelope, RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { toastMessage } from "@workspace/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";
import { formatDateTime } from "@/lib/format/dates";
import { REWARDS_REVIEW_URL_STATE, toPendingRewardsListQuery } from "@/lib/url-state/rewards-review";

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
			return <p className="text-sm text-muted-foreground">Loading…</p>;
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

export default function PendingRewardsPanel({ initialPage }: PendingRewardsPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [rejectingId, setRejectingId] = React.useState<string | null>(null);
	const [rejectReason, setRejectReason] = React.useState<string>("");

	const [urlState, updateUrlState] = useUrlState(REWARDS_REVIEW_URL_STATE);
	const stateKey: string = REWARDS_REVIEW_URL_STATE.serialize(urlState);
	const pendingQuery = api.rewardsAdmin.pendingRewards.useQuery(toPendingRewardsListQuery(urlState), initialDataOption(prefetchedDataFor(initialPage, stateKey)));

	const invalidatePending = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.pendingRewards.scopeKey(undefined) });
	}, [queryClient]);

	const approveMutation = api.rewardsAdmin.approveReward.useMutation({
		onSuccess: async () => {
			toastMessage.success({ title: "Reward approved", description: "The reward is now published." });
			setRejectingId(null);
			setRejectReason("");
			await invalidatePending();
		},
		onError: (error) => {
			toastMutationError("Approval failed", error);
		},
	});

	const rejectMutation = api.rewardsAdmin.rejectReward.useMutation({
		onSuccess: async () => {
			toastMessage.success({ title: "Reward rejected", description: "Returned to draft for merchant edits." });
			setRejectingId(null);
			setRejectReason("");
			await invalidatePending();
		},
		onError: (error) => {
			toastMutationError("Rejection failed", error);
		},
	});

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

	const handleApprove = React.useCallback(
		(rewardId: string): void => {
			approveMutation.mutate({ rewardId });
		},
		[approveMutation],
	);

	const handleStartReject = React.useCallback((rewardId: string): void => {
		setRejectingId(rewardId);
		setRejectReason("");
	}, []);

	const handleCancelReject = React.useCallback((): void => {
		setRejectingId(null);
		setRejectReason("");
	}, []);

	const handleRejectReasonChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setRejectReason(event.target.value);
	}, []);

	const handleConfirmReject = React.useCallback(
		(rewardId: string): void => {
			const trimmed = rejectReason.trim();
			rejectMutation.mutate(trimmed.length > 0 ? { rewardId, reason: trimmed } : { rewardId });
		},
		[rejectMutation, rejectReason],
	);

	const handleApproveClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const rewardId = event.currentTarget.dataset.rewardId;
			if (rewardId !== undefined) {
				handleApprove(rewardId);
			}
		},
		[handleApprove],
	);

	const handleStartRejectClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const rewardId = event.currentTarget.dataset.rewardId;
			if (rewardId !== undefined) {
				handleStartReject(rewardId);
			}
		},
		[handleStartReject],
	);

	const handleConfirmRejectClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const rewardId = event.currentTarget.dataset.rewardId;
			if (rewardId !== undefined) {
				handleConfirmReject(rewardId);
			}
		},
		[handleConfirmReject],
	);

	const isBusy = approveMutation.isPending || rejectMutation.isPending;
	const queueStatus: PendingRewardsQueueStatus = resolveQueueStatus(pendingQuery.isError, pendingQuery.isLoading, rewards.length);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Pending rewards</h1>
				<p className="text-sm text-muted-foreground">Approve or reject consumer rewards submitted by merchants for moderation.</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Moderation queue ({pendingTotal})</CardTitle>
					<CardDescription>Rewards in PENDING_REVIEW status. Referrer rewards publish together when the primary reward is approved.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<PendingRewardsStatus status={queueStatus} onRetry={handleRetry} />
					{rewards.map((reward) => (
						<div key={reward.id} className="space-y-3 rounded-lg border p-4">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0 space-y-1">
									<p className="font-medium">{reward.title}</p>
									<p className="text-sm text-muted-foreground">{reward.description}</p>
									<div className="flex flex-wrap gap-2 pt-1">
										<Badge variant="outline">{reward.organizationName ?? "Merchant"}</Badge>
										<Badge variant="secondary">{reward.rewardType}</Badge>
										<Badge variant="outline">{reward.status}</Badge>
									</div>
								</div>
								{/* `POST /admin/rewards/:id/{approve,reject}` require MANAGE on REWARD — this page's own route rule, enforced by the route guard. */}
								<div className="flex shrink-0 gap-2">
									<Button size="sm" variant="default" disabled={isBusy} data-reward-id={reward.id} onClick={handleApproveClick}>
										<Check className="mr-1 size-4" />
										Approve
									</Button>
									<Button size="sm" variant="outline" disabled={isBusy} data-reward-id={reward.id} onClick={handleStartRejectClick}>
										<X className="mr-1 size-4" />
										Reject
									</Button>
								</div>
							</div>
							<dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
								<div>
									<dt className="font-medium text-foreground">Quantity</dt>
									<dd>
										{reward.quantityRemaining} / {reward.quantityTotal} left
									</dd>
								</div>
								<div>
									<dt className="font-medium text-foreground">Expires</dt>
									<dd>{formatDateTime(reward.expiryDate)}</dd>
								</div>
								<div>
									<dt className="font-medium text-foreground">Category</dt>
									<dd>{reward.category}</dd>
								</div>
								<div>
									<dt className="font-medium text-foreground">Reward ID</dt>
									<dd className="font-mono">{reward.id}</dd>
								</div>
							</dl>
							{rejectingId === reward.id ? (
								<div className="space-y-2 rounded-md border border-dashed p-3">
									<Label htmlFor={`reject-reason-${reward.id}`}>Rejection reason (optional)</Label>
									<Textarea id={`reject-reason-${reward.id}`} value={rejectReason} onChange={handleRejectReasonChange} placeholder="Tell the merchant what to fix…" rows={3} />
									<div className="flex gap-2">
										<Button size="sm" variant="destructive" disabled={isBusy} data-reward-id={reward.id} onClick={handleConfirmRejectClick}>
											Confirm reject
										</Button>
										<Button size="sm" variant="ghost" disabled={isBusy} onClick={handleCancelReject}>
											Cancel
										</Button>
									</div>
								</div>
							) : null}
						</div>
					))}
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
