import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PageHeaderSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type * as React from "react";

import {
	KYB_REVIEW_LOADING_LABELS,
	MERCHANT_DETAIL_LOADING_LABELS,
	MERCHANT_INVITES_LOADING_LABELS,
	STORE_REQUESTS_LOADING_LABELS,
} from "@/components/loading/loading-labels";
import { BadgeSkeleton, CardHeadingSkeleton, LabelledValueGridSkeleton, LabelledValueSkeleton } from "@/components/loading/skeleton-parts";

// ── Merchant invites ─────────────────────────────────────────────────────────

/** The compose card's rows: To, Business, City. */
const INVITE_COMPOSE_ROWS = 3;

/**
 * `/merchants/invites`: header, then the compose card (title bar, three
 * compose rows, send footer) beside the inbox-style email preview.
 */
export function MerchantInvitesPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_INVITES_LOADING_LABELS} className="flex w-full flex-col gap-6">
			<PageHeaderSkeleton className="max-w-2xl" />
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
				<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="border-b px-4 py-3">
						<Skeleton variant="text" className="h-4.5 w-24" />
					</div>
					<div className="divide-y">
						{placeholderKeys("compose-row", INVITE_COMPOSE_ROWS).map((key) => (
							<div key={key} data-skeleton="invite-compose-row" className="flex items-center gap-3 px-4 py-3">
								<Skeleton variant="text" className="h-3.5 w-16" />
								<Skeleton className="h-6 flex-1" />
							</div>
						))}
					</div>
					<div className="flex flex-col items-center gap-2 border-t bg-muted/30 px-4 py-3">
						<Skeleton className="h-9 w-full" />
						<Skeleton variant="text" className="h-3 w-3/4" />
					</div>
				</div>
				<div data-skeleton="email-inbox-preview" className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="flex items-center gap-3 border-b px-4 py-2.5">
						<Skeleton variant="text" className="h-3.5 w-28" />
						<Skeleton className="ms-auto h-8 w-20" />
					</div>
					<div className="flex flex-col gap-3 border-b px-5 py-4">
						<Skeleton variant="text" className="h-6 w-3/4" />
						<div className="flex items-start gap-3">
							<Skeleton variant="circular" className="size-9" />
							<div className="flex min-w-0 flex-1 flex-col gap-1.5">
								<Skeleton variant="text" className="h-3.5 w-48" />
								<Skeleton variant="text" className="h-3.5 w-56 max-w-full" />
							</div>
						</div>
					</div>
					<div className="flex justify-center bg-muted/50 p-4 sm:p-6">
						<Skeleton className="h-[640px] w-full max-w-[720px] rounded-lg" />
					</div>
				</div>
			</div>
		</SkeletonRegion>
	);
}

// ── Store requests ───────────────────────────────────────────────────────────

/** Queue rows drawn while the pending requests load. */
const STORE_REQUEST_SKELETON_ROWS = 3;

/** The pending-queue rows of `/merchants/store-requests` (`LocationRequestRow`): store, merchant, status. */
export function StoreRequestRowsSkeleton(): React.JSX.Element {
	return (
		<>
			{placeholderKeys("request", STORE_REQUEST_SKELETON_ROWS).map((key) => (
				<div key={key} data-skeleton="store-request-row" className="flex items-start justify-between gap-3 rounded-lg border p-4">
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<Skeleton variant="text" className="h-4 w-40 max-w-full" />
						<Skeleton variant="text" className="h-3.5 w-32 max-w-full" />
					</div>
					<BadgeSkeleton />
				</div>
			))}
		</>
	);
}

/** `/merchants/store-requests`: header, then the pending queue card beside the review card. */
export function StoreRequestsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={STORE_REQUESTS_LOADING_LABELS} className="flex flex-col gap-6">
			<PageHeaderSkeleton />
			<div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				<Card>
					<CardHeader>
						<CardHeadingSkeleton />
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						<StoreRequestRowsSkeleton />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardHeadingSkeleton />
					</CardHeader>
					<CardContent>
						<Skeleton variant="text" className="h-3.5 w-56 max-w-full" />
					</CardContent>
				</Card>
			</div>
		</SkeletonRegion>
	);
}

// ── KYB review ───────────────────────────────────────────────────────────────

/** Queue items drawn while the pending KYB queue loads. */
const KYB_QUEUE_SKELETON_ITEMS = 3;
/** The pilot city / team members / last updated row of the merchant card. */
const KYB_SUMMARY_FIELDS = 3;
/** Trading name, legal name, category. */
const KYB_BUSINESS_FIELDS = 3;
/** Contact email, contact phone, owner name, owner email. */
const KYB_CONTACT_FIELDS = 4;

/** `MerchantQueueItem`s: business name + KYB badge over the city · category line. */
export function KybQueueItemsSkeleton(): React.JSX.Element {
	return (
		<>
			{placeholderKeys("queue-item", KYB_QUEUE_SKELETON_ITEMS).map((key) => (
				<div key={key} data-skeleton="kyb-queue-item" className="flex flex-col gap-2 rounded-xl border px-3 py-3">
					<div className="flex items-start justify-between gap-2">
						<Skeleton variant="text" className="h-3.5 w-32" />
						<BadgeSkeleton />
					</div>
					<Skeleton variant="text" className="h-3 w-24" />
				</div>
			))}
		</>
	);
}

/** One titled column of the merchant card (business profile, contact & owner). */
function KybDetailGroupSkeleton({ fields }: { readonly fields: number }): React.JSX.Element {
	return (
		<div className="grid min-w-0 gap-4">
			<div className="flex items-center gap-2">
				<Skeleton className="size-4 rounded-sm" />
				<Skeleton variant="text" className="h-3.5 w-28" />
			</div>
			<LabelledValueGridSkeleton count={fields} className="md:grid-cols-2" />
		</div>
	);
}

/** The selected merchant's KYB card: name + badges, tenant id, summary row, business and contact groups. */
export function KybMerchantCardSkeleton(): React.JSX.Element {
	return (
		<Card data-skeleton="kyb-merchant-card">
			<CardHeader>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<CardHeadingSkeleton />
					<div className="flex shrink-0 gap-2">
						<BadgeSkeleton />
						<BadgeSkeleton />
					</div>
				</div>
			</CardHeader>
			<CardContent className="grid min-w-0 gap-6">
				<div className="grid gap-4">
					<LabelledValueSkeleton index={0} />
					<LabelledValueGridSkeleton count={KYB_SUMMARY_FIELDS} className="md:grid-cols-3" />
				</div>
				<Separator />
				<div className="grid grid-cols-1 gap-8 xl:grid-cols-2 xl:gap-6">
					<KybDetailGroupSkeleton fields={KYB_BUSINESS_FIELDS} />
					<KybDetailGroupSkeleton fields={KYB_CONTACT_FIELDS} />
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * `/merchants/verification`: header (+ "View all merchants"), then the pending
 * queue card beside the merchant picker and the "select a merchant" card.
 */
export function KybReviewPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={KYB_REVIEW_LOADING_LABELS} className="mx-auto flex w-full max-w-10xl min-w-0 flex-col gap-6">
			<PageHeaderSkeleton actions={1} />
			<div className="grid min-w-0 gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
				<Card className="h-fit">
					<CardHeader>
						<CardHeadingSkeleton />
					</CardHeader>
					<CardContent className="grid gap-2">
						<KybQueueItemsSkeleton />
					</CardContent>
				</Card>
				<div className="grid min-w-0 gap-6">
					<Card>
						<CardHeader>
							<CardHeadingSkeleton />
						</CardHeader>
						<CardContent className="flex flex-col gap-2">
							<Skeleton variant="text" className="h-3.5 w-40" />
							<Skeleton className="h-9 w-full" />
						</CardContent>
					</Card>
					<Card>
						<CardContent className="flex justify-center py-10">
							<Skeleton variant="text" className="h-3.5 w-64 max-w-full" />
						</CardContent>
					</Card>
				</div>
			</div>
		</SkeletonRegion>
	);
}

// ── Merchant detail ──────────────────────────────────────────────────────────

/** The merchant summary fields: status, KYB, city, owner, members, onboarded. */
const MERCHANT_SUMMARY_FIELDS = 6;

/** `/merchants/[id]`: header (name + slug), the summary card, then the lifecycle card (state, action, appeals). */
export function MerchantDetailPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_DETAIL_LOADING_LABELS} className="mx-auto flex w-full max-w-10xl min-w-0 flex-col gap-6">
			<PageHeaderSkeleton actions={1} />
			<Card data-skeleton="merchant-summary">
				<CardHeader>
					<CardHeadingSkeleton />
				</CardHeader>
				<CardContent>
					<LabelledValueGridSkeleton count={MERCHANT_SUMMARY_FIELDS} className="md:grid-cols-3" />
				</CardContent>
			</Card>
			<Card data-skeleton="merchant-lifecycle">
				<CardHeader>
					<div className="flex items-center justify-between gap-2">
						<CardHeadingSkeleton />
						<BadgeSkeleton />
					</div>
				</CardHeader>
				<CardContent className="grid gap-4">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-9 w-40" />
				</CardContent>
			</Card>
		</SkeletonRegion>
	);
}
