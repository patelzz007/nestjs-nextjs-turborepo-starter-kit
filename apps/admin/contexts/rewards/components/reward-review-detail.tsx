"use client";

import { useQueryClient } from "@tanstack/react-query";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { formatRewardOffer, rewardTypeLabel } from "@workspace/client/lib/contexts/rewards/reward-offer";
import type { Envelope, RewardResponse } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { EntityAvatar } from "@workspace/ui/components/entity-avatar";
import { Label } from "@workspace/ui/components/label";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Textarea } from "@workspace/ui/components/textarea";
import { toastMessage } from "@workspace/ui/components/toast";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { RewardReviewDetailPageSkeleton } from "@/components/loading/rewards-skeletons";
import { toastMutationError } from "@/lib/api/mutation-error";
import { formatDateTime } from "@/lib/format/dates";
import {
	REWARD_STATUS_PRESENTATION,
	rewardCategoryLabel,
	rewardMinimumSpendLabel,
	rewardQuantityLabel,
	rewardReferralsLabel,
	rewardStoresLabel,
	rewardUsesPerCustomerLabel,
} from "@/contexts/rewards/lib/reward-review-presentation";
import { ROUTES } from "@/lib/routes";

import { RewardReviewImages } from "./reward-review-images";

export interface RewardReviewDetailViewProps {
	readonly rewardId: string;
	/** The server-prefetched `GET /admin/rewards/:rewardId` envelope, or `undefined` when the prefetch failed. */
	readonly initialReward?: Envelope<RewardResponse> | undefined;
}

interface RewardFact {
	readonly label: string;
	readonly value: string;
	readonly isIdentifier?: boolean;
}

/** Everything a reviewer checks besides the copy and the photos, in the order a customer meets it. */
function rewardFacts(reward: RewardResponse): readonly RewardFact[] {
	return [
		{ label: "Offer", value: formatRewardOffer(reward.rewardType, reward.rewardValue) },
		{ label: "Type", value: rewardTypeLabel(reward.rewardType) },
		{ label: "Category", value: rewardCategoryLabel(reward.category) },
		{ label: "Quantity", value: rewardQuantityLabel(reward.quantityRemaining, reward.quantityTotal) },
		{ label: "Starts", value: reward.startDate === null ? "When approved" : formatDateTime(reward.startDate) },
		{ label: "Expires", value: formatDateTime(reward.expiryDate) },
		{ label: "Stores", value: rewardStoresLabel(reward) },
		{ label: "Minimum spend", value: rewardMinimumSpendLabel(reward.rules?.minSpendMyr) },
		{ label: "Uses per customer", value: rewardUsesPerCustomerLabel(reward.rules?.maxUsePerUser) },
		{ label: "Referrals", value: rewardReferralsLabel(reward) },
		{ label: "Reward ID", value: reward.id, isIdentifier: true },
	];
}

interface RejectRewardDialogProps {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly isPending: boolean;
	readonly onConfirm: (reason: string) => void;
}

/** Sends the reward back to the merchant as a draft, with a required note on what to fix. */
function RejectRewardDialog({ open, onOpenChange, isPending, onConfirm }: RejectRewardDialogProps): React.JSX.Element {
	const reasonId = React.useId();
	const [reason, setReason] = React.useState("");

	const handleReasonChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setReason(event.target.value);
	}, []);

	const handleConfirm = React.useCallback((): void => {
		onConfirm(reason);
	}, [onConfirm, reason]);

	const hasReason = reason.trim().length > 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Reject this reward?</DialogTitle>
					<DialogDescription>It goes back to the merchant as a draft. They are notified with your reason.</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor={reasonId}>Reason</Label>
					<Textarea id={reasonId} value={reason} onChange={handleReasonChange} placeholder="Tell the merchant what to fix" rows={4} required aria-required="true" />
				</div>
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
					<Button type="button" variant="destructive" disabled={isPending || !hasReason} onClick={handleConfirm}>
						Reject reward
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * `/rewards/review/[id]` — one reward in full: its photos, copy and every
 * condition, and — while it waits for review — approve or reject. A decision
 * returns the reviewer to the queue.
 */
export default function RewardReviewDetailView({ rewardId, initialReward }: RewardReviewDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isRejectOpen, setIsRejectOpen] = React.useState(false);
	// GET /admin/rewards/:rewardId needs MANAGE REWARD, which the route guard enforces for this page.
	const rewardQuery = api.rewardsAdmin.getReward.useQuery({ rewardId }, initialDataOption(initialReward));
	const reward: RewardResponse | undefined = rewardQuery.data?.data;

	const finishDecision = React.useCallback(async (): Promise<void> => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.pendingRewards.scopeKey(undefined) }),
			queryClient.invalidateQueries({ queryKey: apiRouter.rewardsAdmin.getReward.scopeKey({ rewardId }) }),
		]);
		router.push(ROUTES.rewards.review);
	}, [queryClient, rewardId, router]);

	const approveMutation = api.rewardsAdmin.approveReward.useMutation({
		onSuccess: async () => {
			toastMessage.success({ title: "Reward approved", description: "The reward is now published." });
			await finishDecision();
		},
		onError: (error) => {
			toastMutationError("Approval failed", error);
		},
	});

	const rejectMutation = api.rewardsAdmin.rejectReward.useMutation({
		onSuccess: async () => {
			toastMessage.success({ title: "Reward rejected", description: "Returned to draft for merchant edits." });
			setIsRejectOpen(false);
			await finishDecision();
		},
		onError: (error) => {
			toastMutationError("Rejection failed", error);
		},
	});

	const handleApprove = React.useCallback((): void => {
		approveMutation.mutate({ rewardId });
	}, [approveMutation, rewardId]);

	const handleOpenReject = React.useCallback((): void => {
		setIsRejectOpen(true);
	}, []);

	const handleConfirmReject = React.useCallback(
		(reason: string): void => {
			rejectMutation.mutate({ rewardId, reason: reason.trim() });
		},
		[rejectMutation, rewardId],
	);

	if (rewardQuery.isLoading && reward === undefined) {
		return <RewardReviewDetailPageSkeleton />;
	}

	if (rewardQuery.isError || reward === undefined) {
		return (
			<div className="space-y-4">
				<Link href={ROUTES.rewards.review} className={buttonVariants({ variant: "outline", size: "sm" })}>
					Back to queue
				</Link>
				<p className="text-destructive">Could not load this reward.</p>
			</div>
		);
	}

	const status = REWARD_STATUS_PRESENTATION[reward.status];
	const isAwaitingReview = reward.status === "PENDING_REVIEW";
	const isBusy = approveMutation.isPending || rejectMutation.isPending;
	const merchantName = reward.tenantName ?? "Merchant";

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6">
			<Link href={ROUTES.rewards.review} className={buttonVariants({ variant: "outline", size: "sm" })}>
				Back to queue
			</Link>

			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 space-y-3">
					<StatusBadge tone={status.tone}>{status.label}</StatusBadge>
					<h1 className="text-2xl font-semibold tracking-tight">{reward.title}</h1>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<EntityAvatar name={merchantName} src={reward.tenantLogoUrl} sources={reward.tenantLogoSources} alt="" size="sm" />
						<span>{merchantName}</span>
					</div>
				</div>
				{/* `POST /admin/rewards/:id/{approve,reject}` require MANAGE on REWARD — this page's own route rule, enforced by the route guard. */}
				{isAwaitingReview ? (
					<div className="flex shrink-0 gap-2">
						<Button type="button" disabled={isBusy} onClick={handleApprove}>
							<Check className="size-4" aria-hidden="true" />
							Approve
						</Button>
						<Button type="button" variant="outline" disabled={isBusy} onClick={handleOpenReject}>
							<X className="size-4" aria-hidden="true" />
							Reject
						</Button>
					</div>
				) : null}
			</header>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<div className="min-w-0 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Photos</CardTitle>
						</CardHeader>
						<CardContent>
							<RewardReviewImages rewardId={reward.id} title={reward.title} images={reward.images} />
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Description</CardTitle>
						</CardHeader>
						<CardContent className="space-y-5">
							<p className="text-sm leading-relaxed whitespace-pre-line">{reward.description}</p>
							<section className="space-y-1.5">
								<h2 className="text-sm font-medium">Terms and conditions</h2>
								<p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{reward.termsConditions ?? "None given."}</p>
							</section>
						</CardContent>
					</Card>
				</div>

				<Card className="self-start">
					<CardHeader>
						<CardTitle>Details</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="divide-y text-sm">
							{rewardFacts(reward).map((fact) => (
								<div key={fact.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2.5 first:pt-0 last:pb-0">
									<dt className="text-muted-foreground">{fact.label}</dt>
									<dd className={fact.isIdentifier === true ? "font-mono text-xs leading-5 wrap-break-word" : "wrap-break-word"}>{fact.value}</dd>
								</div>
							))}
						</dl>
					</CardContent>
				</Card>
			</div>

			<RejectRewardDialog open={isRejectOpen} onOpenChange={setIsRejectOpen} isPending={rejectMutation.isPending} onConfirm={handleConfirmReject} />
		</div>
	);
}
