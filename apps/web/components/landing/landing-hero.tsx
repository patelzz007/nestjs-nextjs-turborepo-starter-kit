import { RewardCategoryVisual } from "@/components/rewardhub/detail/category-visual";
import { RewardInventoryBar } from "@/components/rewardhub/detail/inventory-bar";
import type { FeaturedOffer } from "@/lib/rewards/featured-offers";
import { buttonVariants } from "@workspace/ui/components/button";
import { PLATFORM_DISPLAY_REGION } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { ArrowDown, ArrowRight, ChevronRight, Gift, Home, MapPin, QrCode, Search, Ticket, Wallet } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { landingSectionPath, LANDING_SECTION_IDS, publicRewardDetailPath } from "@/lib/routes";

/** Cities in the pilot — the only places offers are redeemable today. */
const PILOT_CITIES: readonly string[] = ["Kuala Lumpur", "Melaka"];

export interface LandingHeroProps {
	/** Claimable offers to preview, soonest-ending first (empty hides the preview). */
	readonly featuredOffers: readonly FeaturedOffer[];
	/** Live offers in the catalogue; `undefined` when the count could not be loaded. */
	readonly liveOfferCount: number | undefined;
	/** Where the secondary call to action leads: sign-in for guests, the dashboard once signed in. */
	readonly secondaryAction: { readonly label: string; readonly href: string };
}

/**
 * Landing hero: the pitch, two calls to action and a phone-shaped preview of
 * real, current offers. It extends up beneath the transparent landing header
 * (`-mt-16 pt-16`), so header and hero read as one surface until the page
 * scrolls. Presentational — the page selects the offers and the action.
 */
export function LandingHero({ featuredOffers, liveOfferCount, secondaryAction }: LandingHeroProps): React.JSX.Element {
	const hasPreview = featuredOffers.length > 0;

	return (
		<section aria-labelledby="landing-hero-heading" className="relative isolate -mt-16 overflow-hidden pt-16">
			<HeroBackdrop />

			<div
				className={cn(
					"mx-auto grid grid-cols-1 items-center gap-14 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-20 lg:px-8 lg:pt-24 lg:pb-24",
					hasPreview ? "max-w-6xl lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]" : "max-w-3xl text-center",
				)}>
				<div>
					<p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase shadow-xs backdrop-blur-sm">
						<MapPin className="size-3.5" aria-hidden="true" />
						{PILOT_CITIES.join(" & ")} pilot
					</p>
					<h1
						id="landing-hero-heading"
						className="mt-6 font-[family-name:var(--font-heading)] text-5xl leading-[1.02] font-medium tracking-tight text-balance text-foreground sm:text-6xl lg:text-7xl">
						Rewards from the places you{" "}
						<span className="relative whitespace-nowrap text-primary">
							already love
							<HandDrawnUnderline />
						</span>
					</h1>
					<p className={cn("mt-6 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg", !hasPreview && "mx-auto")}>
						Free items and discounts from local cafés, restaurants and shops. Look around without an account — sign in when you&apos;re ready to claim, then redeem in store
						with a QR code.
					</p>

					<div className={cn("mt-9 flex flex-col gap-3 sm:flex-row", !hasPreview && "justify-center")}>
						<Link href={landingSectionPath(LANDING_SECTION_IDS.rewards)} className={cn(buttonVariants({ size: "lg" }), "h-12 min-w-44 px-5 shadow-lg shadow-primary/25")}>
							Browse offers
							<ArrowDown className="size-4" aria-hidden="true" />
						</Link>
						<Link href={secondaryAction.href} className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 min-w-44 bg-background/70 px-5 backdrop-blur-sm")}>
							{secondaryAction.label}
							<ArrowRight className="size-4" aria-hidden="true" />
						</Link>
					</div>

					<dl className={cn("mt-10 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3", !hasPreview && "sm:justify-center")}>
						<HeroStat icon={<Ticket className="size-4" aria-hidden="true" />} label="Live offers" value={liveOfferCount === undefined ? "—" : String(liveOfferCount)} />
						<HeroStat icon={<MapPin className="size-4" aria-hidden="true" />} label="Pilot cities" value={String(PILOT_CITIES.length)} />
						<HeroStat icon={<QrCode className="size-4" aria-hidden="true" />} label="Redeem" value="In store" />
					</dl>
				</div>

				{hasPreview ? <PhonePreview offers={featuredOffers} /> : null}
			</div>
		</section>
	);
}

/** Decorative backdrop — brand-coloured light fields over a faint dot grid, all from theme tokens. */
function HeroBackdrop(): React.JSX.Element {
	return (
		<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
			<div className="absolute inset-0 bg-linear-to-b from-secondary via-background to-background" />
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] mask-[linear-gradient(to_bottom,black,transparent_85%)] bg-size-[22px_22px]" />
			<div className="absolute -top-40 -left-32 size-[34rem] rounded-full bg-[radial-gradient(closest-side,oklch(from_var(--primary)_l_c_h_/_0.22),transparent)]" />
			<div className="absolute top-10 -right-40 size-[40rem] rounded-full bg-[radial-gradient(closest-side,oklch(from_var(--chart-2)_l_c_h_/_0.16),transparent)]" />
			<div className="absolute bottom-0 left-1/3 size-[26rem] rounded-full bg-[radial-gradient(closest-side,oklch(from_var(--chart-3)_l_c_h_/_0.14),transparent)]" />
			<div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-border to-transparent" />
		</div>
	);
}

/** A loose, hand-drawn underline beneath the accent words. */
function HandDrawnUnderline(): React.JSX.Element {
	return (
		<svg aria-hidden="true" viewBox="0 0 300 12" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full text-primary/40">
			<path d="M2 9C60 3 140 2 298 7" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
		</svg>
	);
}

interface HeroStatProps {
	readonly icon: React.ReactNode;
	readonly label: string;
	readonly value: string;
}

function HeroStat({ icon, label, value }: HeroStatProps): React.JSX.Element {
	return (
		<div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background/70 px-3 py-2 shadow-xs backdrop-blur-sm sm:pr-4 sm:pl-2">
			<span className="hidden size-9 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">{icon}</span>
			<div className="text-left leading-tight">
				<dt className="text-xs text-muted-foreground">{label}</dt>
				<dd className="text-sm font-semibold text-foreground tabular-nums">{value}</dd>
			</div>
		</div>
	);
}

interface PhonePreviewProps {
	readonly offers: readonly FeaturedOffer[];
}

/**
 * A phone-shaped preview of the consumer app holding REAL offers (each links
 * to its detail page). The device chrome and tab bar are decorative.
 */
function PhonePreview({ offers }: PhonePreviewProps): React.JSX.Element {
	return (
		<div className="relative mx-auto w-full max-w-[25rem] lg:mr-0">
			{/* Soft brand halo behind the device. */}
			<div aria-hidden="true" className="absolute inset-x-6 top-10 bottom-0 -z-10 rounded-[3rem] bg-primary/25 blur-3xl" />

			<div className="rounded-[2.75rem] border border-border/80 bg-foreground/90 p-2.5 shadow-2xl shadow-primary/20 dark:bg-card dark:ring-1 dark:ring-border">
				<div className="overflow-hidden rounded-[2.25rem] bg-background">
					{/* Status bar + notch (decorative). */}
					<div aria-hidden="true" className="relative flex h-8 items-center justify-between px-6 text-[0.625rem] font-semibold text-foreground">
						<span>9:41</span>
						<span className="absolute top-2 left-1/2 h-4 w-20 -translate-x-1/2 rounded-full bg-foreground/90 dark:bg-card" />
						<span className="flex gap-1">
							<span className="size-1.5 rounded-full bg-foreground/70" />
							<span className="size-1.5 rounded-full bg-foreground/70" />
							<span className="size-1.5 rounded-full bg-foreground/40" />
						</span>
					</div>

					<section aria-labelledby="landing-featured-heading" className="px-4 pt-2 pb-4">
						<div aria-hidden="true" className="flex items-center gap-2">
							<span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
								<Gift className="size-3.5" />
							</span>
							<span className="text-sm font-semibold text-foreground">Rewardly</span>
						</div>
						<div className="mt-4 flex items-end justify-between gap-2">
							<h2 id="landing-featured-heading" className="text-lg font-semibold tracking-tight text-foreground">
								Ending soon
							</h2>
							<span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 px-2 py-0.5 text-[0.6875rem] font-medium text-foreground">
								<span aria-hidden="true" className="size-1.5 rounded-full bg-success motion-safe:animate-pulse" />
								Live now
							</span>
						</div>

						<ul className="mt-3 space-y-2.5">
							{offers.map((offer: FeaturedOffer): React.JSX.Element => (
								<li key={offer.id}>
									<Link
										href={publicRewardDetailPath(offer.id)}
										className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-xs transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0">
										<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
											<RewardCategoryVisual category={offer.category} className="size-5" />
										</span>
										<span className="min-w-0 flex-1">
											<span className="line-clamp-2 text-sm leading-snug font-semibold text-foreground">{offer.title}</span>
											<span className="mt-0.5 flex min-w-0 gap-1 text-xs text-muted-foreground">
												{offer.merchantName === undefined ? null : <span className="truncate">{offer.merchantName} ·</span>}
												<span className="shrink-0">Until {formatEpochMs(offer.expiryDate, "dayMonth", PLATFORM_DISPLAY_REGION)}</span>
											</span>
											<RewardInventoryBar compact remaining={offer.remaining} total={offer.total} className="mt-2" />
										</span>
										<ChevronRight
											className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
											aria-hidden="true"
										/>
									</Link>
								</li>
							))}
						</ul>
					</section>

					{/* Tab bar (decorative). */}
					<div aria-hidden="true" className="grid grid-cols-4 border-t border-border/80 px-2 py-2.5 text-muted-foreground">
						<span className="flex justify-center text-primary">
							<Home className="size-4" />
						</span>
						<span className="flex justify-center">
							<Search className="size-4" />
						</span>
						<span className="flex justify-center">
							<Wallet className="size-4" />
						</span>
						<span className="flex justify-center">
							<QrCode className="size-4" />
						</span>
					</div>
				</div>
			</div>

			{/* Floating "how you redeem" card — the product's promise, not data. */}
			<div className="absolute -bottom-6 -left-4 hidden items-center gap-3 rounded-2xl border border-border/80 bg-card/95 p-3 pr-4 shadow-xl backdrop-blur-sm sm:flex lg:-left-12">
				<span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
					<QrCode className="size-5" aria-hidden="true" />
				</span>
				<span className="leading-tight">
					<span className="block text-sm font-semibold text-foreground">Redeem in store</span>
					<span className="block text-xs text-muted-foreground">Show your QR at the counter</span>
				</span>
			</div>
		</div>
	);
}
