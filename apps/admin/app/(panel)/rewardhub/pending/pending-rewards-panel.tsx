"use client";

import { stubApiMeta } from "@/lib/api-envelope";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/auth";
import type { RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Label } from "@workspace/ui/components/form/label";
import { Textarea } from "@workspace/ui/components/form/textarea";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import * as React from "react";

export interface PendingRewardsPanelProps {
	readonly initialRewards?: readonly RewardResponse[];
}

function formatEpochMs(value: number): string {
	return new Date(value).toLocaleString();
}

export default function PendingRewardsPanel({ initialRewards }: PendingRewardsPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [rejectingId, setRejectingId] = React.useState<string | null>(null);
	const [rejectReason, setRejectReason] = React.useState<string>("");

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

	const pendingQuery = api.rewardsAdmin.pendingRewards.useQuery({}, { initialData: initialQueryData });

	const invalidatePending = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.pendingRewards.queryKey({}) });
	}, [queryClient]);

	const approveMutation = api.rewardsAdmin.approveReward.useMutation({
		onSuccess: async () => {
			toastMessage.success({ title: "Reward approved", description: "The reward is now published." });
			setRejectingId(null);
			setRejectReason("");
			await invalidatePending();
		},
		onError: (error) => {
			toastMessage.error({ title: "Approval failed", description: error.message });
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
			toastMessage.error({ title: "Rejection failed", description: error.message });
		},
	});

	const rewards = pendingQuery.data?.data ?? [];

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

	const isBusy = approveMutation.isPending || rejectMutation.isPending;

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Pending rewards</h1>
				<p className="text-sm text-muted-foreground">Approve or reject consumer rewards submitted by merchants for moderation.</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Moderation queue ({rewards.length})</CardTitle>
					<CardDescription>Rewards in PENDING_REVIEW status. Referrer rewards publish together when the primary reward is approved.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{pendingQuery.isLoading && rewards.length === 0 ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
					{!pendingQuery.isLoading && rewards.length === 0 ? <p className="text-sm text-muted-foreground">No rewards waiting for review.</p> : null}
					{rewards.map((reward) => (
						<div key={reward.id} className="space-y-3 rounded-lg border p-4">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0 space-y-1">
									<p className="font-medium">{reward.title}</p>
									<p className="text-sm text-muted-foreground">{reward.description}</p>
									<div className="flex flex-wrap gap-2 pt-1">
										<Badge variant="outline">{reward.merchantName ?? "Merchant"}</Badge>
										<Badge variant="secondary">{reward.rewardType}</Badge>
										<Badge variant="outline">{reward.status}</Badge>
									</div>
								</div>
								<div className="flex shrink-0 gap-2">
									<Button size="sm" variant="default" disabled={isBusy} onClick={() => handleApprove(reward.id)}>
										<Check className="mr-1 size-4" />
										Approve
									</Button>
									<Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleStartReject(reward.id)}>
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
									<dd>{formatEpochMs(reward.expiryDate)}</dd>
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
										<Button size="sm" variant="destructive" disabled={isBusy} onClick={() => handleConfirmReject(reward.id)}>
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
				</CardContent>
			</Card>
		</div>
	);
}
