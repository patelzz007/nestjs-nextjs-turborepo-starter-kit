"use client";

import { EntityAvatar } from "@workspace/ui/components/entity-avatar";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { CalendarClock, Mail, MapPin, type LucideIcon } from "lucide-react";
import type { JSX } from "react";

import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";

/** The surface every onboarding panel sits on, so the summary, timeline and form read as one set. */
export const ONBOARDING_PANEL_CLASS_NAME = "rounded-2xl border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm";

interface InviteDetailProps {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly value: string;
}

function InviteDetail({ icon: Icon, label, value }: InviteDetailProps): JSX.Element {
	return (
		<div className="flex min-w-0 items-start gap-3">
			<span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
				<Icon className="size-3.5" />
			</span>
			<div className="min-w-0">
				<dt className="text-xs text-muted-foreground">{label}</dt>
				<dd className="truncate text-sm font-medium text-foreground" title={value}>
					{value}
				</dd>
			</div>
		</div>
	);
}

export interface MerchantOnboardingInviteSummaryProps {
	readonly businessName: string;
	readonly email: string;
	/** Already formatted for display. */
	readonly city: string;
	/** Already formatted for display. */
	readonly expiresOn: string;
}

/** Who the invite is for: the business's mark and name, then the invite's fixed details. */
export function MerchantOnboardingInviteSummary({ businessName, email, city, expiresOn }: MerchantOnboardingInviteSummaryProps): JSX.Element {
	return (
		<div className={cn(ONBOARDING_PANEL_CLASS_NAME, "p-5")}>
			<div className="flex items-center gap-3">
				<EntityAvatar name={businessName} alt="" size="lg" />
				<div className="min-w-0">
					<p className="text-xs font-medium tracking-wide text-primary uppercase">Merchant application</p>
					<h2 className="truncate text-lg font-semibold tracking-tight" title={businessName}>
						{businessName}
					</h2>
				</div>
			</div>
			<dl className="mt-4 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2 lg:grid-cols-1">
				<div className="sm:col-span-2 lg:col-span-1">
					<InviteDetail icon={Mail} label="Work email" value={email} />
				</div>
				<InviteDetail icon={MapPin} label="Pilot city" value={city} />
				<InviteDetail icon={CalendarClock} label="Invite expires" value={expiresOn} />
			</dl>
		</div>
	);
}

/** Placeholder fields in the loading form — the first step's business fields. */
const SKELETON_FIELD_COUNT = 3;
/** The invite's fixed details: work email, pilot city, expiry. */
const SKELETON_DETAIL_COUNT = 3;

/** What the wizard announces while the invite is verified. */
export const MERCHANT_ONBOARDING_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Verifying your invite…" };

export interface MerchantOnboardingSkeletonProps {
	/** One placeholder timeline row per wizard step. */
	readonly stepCount: number;
}

/**
 * The wizard's layout while the invite is verified — the invite summary, the
 * step timeline and the first step's form — so nothing shifts when it loads.
 * One announced, busy region; the bones themselves stay out of the accessibility tree.
 */
export function MerchantOnboardingSkeleton({ stepCount }: MerchantOnboardingSkeletonProps): JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_ONBOARDING_LOADING_LABELS} className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-8">
			<div className="flex flex-col gap-4">
				<div className={cn(ONBOARDING_PANEL_CLASS_NAME, "p-5")}>
					<div className="flex items-center gap-3">
						<Skeleton className="size-12 rounded-xl" />
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<Skeleton variant="text" className="h-3 w-28" />
							<Skeleton variant="text" className="h-5 w-40 max-w-full" />
						</div>
					</div>
					<div className="mt-4 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2 lg:grid-cols-1">
						{placeholderKeys("detail", SKELETON_DETAIL_COUNT).map((key): JSX.Element => (
							<div key={key} className="flex items-start gap-3">
								<Skeleton className="size-7 rounded-lg" />
								<div className="flex min-w-0 flex-1 flex-col gap-1.5">
									<Skeleton variant="text" className="h-3 w-20" />
									<Skeleton variant="text" className="h-3.5 w-36 max-w-full" />
								</div>
							</div>
						))}
					</div>
				</div>
				<div className={cn(ONBOARDING_PANEL_CLASS_NAME, "hidden flex-col gap-5 p-5 lg:flex")}>
					<div className="flex flex-col gap-2">
						<div className="flex justify-between gap-3">
							<Skeleton variant="text" className="h-3 w-32" />
							<Skeleton variant="text" className="h-3 w-8" />
						</div>
						<Skeleton className="h-1.5 w-full rounded-full" />
					</div>
					<div className="flex flex-col gap-6">
						{placeholderKeys("step", stepCount).map((key): JSX.Element => (
							<div key={key} data-slot="onboarding-step-skeleton" className="flex items-start gap-3">
								<Skeleton variant="circular" className="size-8" />
								<div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1.5">
									<Skeleton variant="text" className="h-3.5 w-24" />
									<Skeleton variant="text" className="h-3 w-36 max-w-full" />
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
			<div className={cn(ONBOARDING_PANEL_CLASS_NAME, "p-5 sm:p-6")}>
				<div className="mb-6 flex flex-col gap-2 border-b border-border/70 pb-5">
					<Skeleton variant="text" className="h-3 w-28" />
					<Skeleton variant="text" className="h-6 w-56 max-w-full" />
					<Skeleton variant="text" className="h-3.5 w-80 max-w-full" />
				</div>
				<div className="flex flex-col gap-5">
					{placeholderKeys("field", SKELETON_FIELD_COUNT).map((key): JSX.Element => (
						<div key={key} className="flex flex-col gap-2">
							<Skeleton variant="text" className="h-3.5 w-28" />
							<Skeleton className="h-11 w-full" />
						</div>
					))}
					<Skeleton className="ms-auto h-11 w-32" />
				</div>
			</div>
		</SkeletonRegion>
	);
}
