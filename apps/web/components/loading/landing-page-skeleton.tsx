"use client";

import { LANDING_LOADING_LABELS } from "@/components/loading/loading-labels";
import { cycledWidth, placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { RewardBrowseBones } from "@/components/loading/reward-catalog-skeleton";
import { FEATURED_MERCHANT_LIMIT, FEATURED_OFFER_LIMIT } from "@/contexts/rewards/lib/featured-offers";
import { useRewardsViewMode } from "@workspace/client/lib/features/ui-preferences/facade";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** The hero's stat pills: live offers, pilot cities, redeem. */
const HERO_STAT_COUNT = 3;
/** The phone preview's decorative tab bar: home, search, wallet, QR. */
const PHONE_TAB_COUNT = 4;
const MERCHANT_CHIP_WIDTHS: readonly string[] = ["w-32", "w-24", "w-36", "w-28"];

/** `LandingHero` with a featured-offer preview: pill, display headline, intro, two actions and the stat pills beside a phone. */
function LandingHeroSkeleton(): React.JSX.Element {
	return (
		<section className="relative isolate -mt-16 overflow-hidden pt-16">
			<div className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-secondary via-background to-background" />
			<div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:px-8 lg:pt-24 lg:pb-24">
				<div>
					<Skeleton variant="text" className="h-7 w-48" />
					<div className="mt-6 flex flex-col gap-3">
						<Skeleton className="h-11 w-full sm:h-14 lg:h-16" />
						<Skeleton className="h-11 w-3/4 sm:h-14 lg:h-16" />
					</div>
					<div className="mt-6 flex max-w-xl flex-col gap-3 py-1">
						<Skeleton variant="text" className="h-4 w-full" />
						<Skeleton variant="text" className="h-4 w-11/12" />
						<Skeleton variant="text" className="h-4 w-2/5" />
					</div>
					<div className="mt-9 flex flex-col gap-3 sm:flex-row">
						<Skeleton className="h-12 w-full sm:w-44" />
						<Skeleton className="h-12 w-full sm:w-52" />
					</div>
					<div className="mt-10 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
						{placeholderKeys("hero-stat", HERO_STAT_COUNT).map((key) => (
							<Skeleton key={key} className="h-14 rounded-2xl sm:w-36" />
						))}
					</div>
				</div>
				<PhonePreviewSkeleton />
			</div>
		</section>
	);
}

/** The phone-shaped featured-offers preview: device frame, brand row, "Ending soon" heading, offer rows, tab bar. */
function PhonePreviewSkeleton(): React.JSX.Element {
	return (
		<div className="relative mx-auto w-full max-w-[25rem] lg:mr-0">
			<div className="rounded-[2.75rem] border border-border/80 bg-card p-2.5 shadow-xl">
				<div className="overflow-hidden rounded-[2.25rem] bg-background">
					<div className="h-8" />
					<div className="px-4 pt-2 pb-4">
						<div className="flex items-center gap-2">
							<Skeleton className="size-7 rounded-lg" />
							<Skeleton variant="text" className="h-4 w-20" />
						</div>
						<div className="mt-4 flex items-end justify-between gap-2">
							<Skeleton variant="text" className="my-0.5 h-5 w-28" />
							<Skeleton variant="text" className="h-5 w-20" />
						</div>
						<div className="mt-3 space-y-2.5">
							{placeholderKeys("featured", FEATURED_OFFER_LIMIT).map((key) => (
								<div key={key} data-slot="featured-offer-skeleton" className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-xs">
									<Skeleton className="size-10 rounded-xl" />
									<div className="flex min-w-0 flex-1 flex-col gap-1.5">
										<Skeleton variant="text" className="h-3.5 w-4/5" />
										<Skeleton variant="text" className="h-3 w-3/5" />
										<Skeleton variant="text" className="mt-1.5 h-1 w-full" />
									</div>
								</div>
							))}
						</div>
					</div>
					<div className="grid grid-cols-4 border-t border-border/80 px-2 py-2.5">
						{placeholderKeys("tab", PHONE_TAB_COUNT).map((key) => (
							<div key={key} className="flex justify-center">
								<Skeleton className="size-4 rounded-sm" />
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

/** `LandingMerchants`: the "Offers from local favourites" label beside a row of merchant chips. */
function LandingMerchantsSkeleton(): React.JSX.Element {
	return (
		<section className="border-b border-border/80 py-10">
			<div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 sm:px-6 lg:flex-row lg:gap-8 lg:px-8">
				<Skeleton variant="text" className="h-4 w-48" />
				<div className="flex flex-wrap justify-center gap-2.5 lg:justify-start">
					{placeholderKeys("merchant", FEATURED_MERCHANT_LIMIT).map((key, index) => (
						<Skeleton key={key} variant="text" className={cn("h-9", cycledWidth(MERCHANT_CHIP_WIDTHS, index, "w-28"))} />
					))}
				</div>
			</div>
		</section>
	);
}

/**
 * The landing page (`/`) while the server reads the session and the catalog:
 * hero with the phone preview, the merchant strip, and the "Live offers"
 * catalog section in the visitor's saved grid/list layout. Sits inside
 * `LandingShell`, which stays real.
 */
export function LandingPageSkeleton(): React.JSX.Element {
	const viewMode = useRewardsViewMode();
	return (
		<SkeletonRegion labels={LANDING_LOADING_LABELS}>
			<LandingHeroSkeleton />
			<LandingMerchantsSkeleton />
			<section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
				<RewardBrowseBones variant="landing" viewMode={viewMode} />
			</section>
		</SkeletonRegion>
	);
}
