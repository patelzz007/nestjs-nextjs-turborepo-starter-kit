"use client";

import { MerchantRewardDetailPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import { MerchantCapabilityGate } from "@/components/access/merchant-capability-gate";
import { MerchantRewardStatusBadge } from "@/components/merchant-ui/reward-status";
import { RewardPageBackLink } from "@/components/rewards/merchant-reward-editor-layout";
import { MerchantRewardUnavailable } from "@/components/rewards/merchant-reward-unavailable";
import { RewardStockMeter } from "@/components/rewards/reward-stock-meter";
import { describeRewardStores, isRewardEnded } from "@/lib/rewards/presentation";
import { invalidateMerchantRewardsListCache, upsertMerchantRewardInListCache } from "@/lib/rewards/query-cache";
import { describeRewardStatusNote, formatRewardClaimLimit, formatRewardMinimumSpend, formatRewardRunDates } from "@/lib/rewards/reward-detail";
import { isRewardEditable, useMerchantReward } from "@/lib/rewards/use-merchant-reward";
import { orgRoutes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { formatRewardOffer, rewardTypeLabel } from "@workspace/client/lib/rewards/reward-offer";
import { MERCHANT_CAPABILITY, PLATFORM_DISPLAY_REGION, type Envelope, type RewardResponse } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { ImageCarousel, type ImageCarouselImage } from "@workspace/ui/components/image-carousel";
import { Spinner } from "@workspace/ui/components/spinner";
import { toastMessage } from "@workspace/ui/components/toast";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatCount } from "@workspace/ui/lib/format/number";
import { Card } from "@workspace/ui/components/card";
import { Pencil } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/** The gallery fills a little over half the page on wide screens, the full width below. */
const GALLERY_SIZES = "(min-width: 1024px) 55vw, 100vw";

export interface MerchantRewardDetailPageViewProps {
	readonly orgSlug: string;
	readonly rewardId: string;
	/**
	 * The organization's reward list as the server fetched it (the API's own envelope). The API has no
	 * merchant reward-detail endpoint yet, so the page reads the reward out of the list.
	 */
	readonly initialRewards?: Envelope<RewardResponse[]> | undefined;
}

/** Reward page — viewing needs `merchant:view_rewards`; its edit and submit actions need `merchant:manage_rewards`. */
export function MerchantRewardDetailPageView(props: MerchantRewardDetailPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.viewRewards} loading={<MerchantRewardDetailPageSkeleton />}>
			<MerchantRewardDetailPageContent {...props} />
		</MerchantCapabilityGate>
	);
}

function MerchantRewardDetailPageContent({ orgSlug, rewardId, initialRewards }: MerchantRewardDetailPageViewProps): React.JSX.Element {
	const state = useMerchantReward(orgSlug, rewardId, initialRewards);

	if (state.kind === "loading") {
		return <MerchantRewardDetailPageSkeleton />;
	}
	if (state.kind !== "ready") {
		return <MerchantRewardUnavailable state={state} rewardsHref={orgRoutes(orgSlug).rewards.list} />;
	}
	return <MerchantRewardDetail orgSlug={orgSlug} reward={state.reward} />;
}

interface MerchantRewardDetailProps {
	readonly orgSlug: string;
	readonly reward: RewardResponse;
}

interface DetailRowProps {
	readonly term: string;
	readonly children: React.ReactNode;
}

/** One fact of the details list: the term on the left, its value on the right (stacked on phones). */
function DetailRow({ term, children }: DetailRowProps): React.JSX.Element {
	return (
		<div className="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
			<dt className="text-sm text-muted-foreground">{term}</dt>
			<dd className="text-sm text-foreground">{children}</dd>
		</div>
	);
}

interface StatProps {
	readonly label: string;
	readonly value: number;
}

/** A count of the performance row: the number large, its label under it. */
function Stat({ label, value }: StatProps): React.JSX.Element {
	return (
		<div className="flex flex-col gap-1 px-5 py-4 sm:px-6">
			<dt className="order-last text-sm text-muted-foreground">{label}</dt>
			<dd className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{formatCount(value, PLATFORM_DISPLAY_REGION.locale)}</dd>
		</div>
	);
}

/** The reward as the merchant reviews it: the photos and offer first, then how it is doing, then every detail. */
function MerchantRewardDetail({ orgSlug, reward }: MerchantRewardDetailProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const { can } = useAuthorization();
	const routes = orgRoutes(orgSlug);
	const canManageRewards = can(MERCHANT_CAPABILITY.manageRewards);
	const canEdit = canManageRewards && isRewardEditable(reward.status);
	const canSubmit = canManageRewards && reward.status === "DRAFT";
	const ended = isRewardEnded(reward.status);
	const stores = describeRewardStores(reward);

	const images = React.useMemo(
		(): readonly ImageCarouselImage[] =>
			reward.images.map((image, index): ImageCarouselImage => ({
				id: image.fileId,
				src: image.url,
				sources: image.sources,
				alt: `${reward.title}, photo ${String(index + 1)}`,
			})),
		[reward.images, reward.title],
	);

	const publishMutation = api.organizations.rewards.publish.useMutation({
		onSuccess: (response): void => {
			upsertMerchantRewardInListCache(queryClient, orgSlug, response.data);
			toastMessage.success({ title: "Submitted for review", description: "It's reviewed before it goes live." });
			void invalidateMerchantRewardsListCache(queryClient, orgSlug);
		},
		onError: (): void => {
			toastMessage.error({ title: "Not submitted", description: "Check your connection and try again." });
		},
	});

	const { mutate: publish } = publishMutation;
	const handleSubmitForReview = React.useCallback((): void => {
		publish({ orgSlug, rewardId: reward.id });
	}, [orgSlug, publish, reward.id]);

	return (
		<div className="flex flex-col gap-8">
			<RewardPageBackLink href={routes.rewards.list} label="Rewards" />

			<section aria-labelledby="reward-title" className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10">
				<ImageCarousel images={images} sizes={GALLERY_SIZES} priority frameClassName={cn("rounded-xl border border-border", ended ? "grayscale" : null)} />

				<div className="flex flex-col gap-5 lg:pt-2">
					<div className="flex flex-wrap items-center gap-3">
						<MerchantRewardStatusBadge status={reward.status} />
						<span className="text-sm text-muted-foreground">{rewardTypeLabel(reward.rewardType)}</span>
					</div>

					<div className="flex flex-col gap-3">
						<p
							className={cn(
								"text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl",
								ended ? "text-muted-foreground" : "text-primary dark:text-foreground",
							)}>
							{formatRewardOffer(reward.rewardType, reward.rewardValue)}
						</p>
						<h1 id="reward-title" className="text-xl font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
							{reward.title}
						</h1>
						<p className="max-w-prose text-base leading-relaxed whitespace-pre-line text-muted-foreground">{reward.description}</p>
					</div>

					<p data-slot="reward-status-note" className="text-sm text-foreground">
						{describeRewardStatusNote(reward.status)}
					</p>

					{canEdit || canSubmit ? (
						<div className="flex flex-wrap gap-2">
							{canSubmit ? (
								<Button type="button" disabled={publishMutation.isPending} onClick={handleSubmitForReview}>
									{publishMutation.isPending ? <Spinner className="size-4" aria-hidden="true" /> : null}
									{publishMutation.isPending ? "Submitting…" : "Submit for review"}
								</Button>
							) : null}
							{canEdit ? (
								<Link href={routes.rewards.edit(reward.id)} className={cn(buttonVariants({ variant: canSubmit ? "outline" : "default" }))}>
									<Pencil className="size-4" aria-hidden="true" />
									Edit reward
								</Link>
							) : null}
						</div>
					) : null}
				</div>
			</section>

			<section aria-labelledby="reward-performance-heading" className="flex flex-col gap-3">
				<h2 id="reward-performance-heading" className="text-base font-semibold text-foreground">
					Performance
				</h2>
				<Card className="gap-0 py-0">
					<dl className="grid divide-y divide-border sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] sm:divide-x sm:divide-y-0">
						<Stat label="Claimed" value={reward.claimCount} />
						<Stat label="Redeemed" value={reward.redemptionCount} />
						<div className="flex flex-col justify-center gap-1 px-5 py-4 sm:px-6">
							<dt className="order-last text-sm text-muted-foreground">In stock</dt>
							<dd>
								<RewardStockMeter remaining={reward.quantityRemaining} total={reward.quantityTotal} ended={ended} />
							</dd>
						</div>
					</dl>
				</Card>
			</section>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
				<section aria-labelledby="reward-details-heading" className="flex flex-col gap-3">
					<h2 id="reward-details-heading" className="text-base font-semibold text-foreground">
						Details
					</h2>
					<Card className="gap-0 px-5 py-2 sm:px-6">
						<dl className="divide-y divide-border">
							<DetailRow term="Runs">{formatRewardRunDates(reward)}</DetailRow>
							<DetailRow term="Each customer">{formatRewardClaimLimit(reward.rules)}</DetailRow>
							<DetailRow term="Minimum spend">{formatRewardMinimumSpend(reward.rules)}</DetailRow>
							<DetailRow term="Stores">
								<span title={stores.fullLabel}>{stores.label}</span>
							</DetailRow>
							<DetailRow term="Category">
								<span className="capitalize">{reward.category}</span>
							</DetailRow>
						</dl>
					</Card>
				</section>

				<section aria-labelledby="reward-terms-heading" className="flex flex-col gap-3">
					<h2 id="reward-terms-heading" className="text-base font-semibold text-foreground">
						Terms and conditions
					</h2>
					<Card className="gap-0 px-5 py-4 sm:px-6">
						<p className={cn("text-sm leading-relaxed whitespace-pre-line", reward.termsConditions === null ? "text-muted-foreground" : "text-foreground")}>
							{reward.termsConditions ?? "No extra terms."}
						</p>
					</Card>
				</section>
			</div>
		</div>
	);
}
