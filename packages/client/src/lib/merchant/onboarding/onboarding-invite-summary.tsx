"use client";

import { EntityAvatar } from "@workspace/ui/components/entity-avatar";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import { CalendarClock, Mail, MapPin, type LucideIcon } from "lucide-react";
import type { JSX } from "react";

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

/** Number of placeholder fields in the loading form. */
const SKELETON_FIELD_COUNT = 3;

export interface MerchantOnboardingSkeletonProps {
	/** One placeholder timeline row per wizard step. */
	readonly stepCount: number;
}

/** The wizard's layout while the invite is verified, so nothing shifts when it loads. */
export function MerchantOnboardingSkeleton({ stepCount }: MerchantOnboardingSkeletonProps): JSX.Element {
	return (
		<div role="status" className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-8">
			<span className="sr-only">Verifying your invite…</span>
			<div className="space-y-4" aria-hidden="true">
				<div className={cn(ONBOARDING_PANEL_CLASS_NAME, "space-y-4 p-5")}>
					<div className="flex items-center gap-3">
						<Skeleton className="size-12 rounded-xl" />
						<div className="flex-1 space-y-2">
							<Skeleton size="sm" className="w-24" />
							<Skeleton className="h-5 w-40" />
						</div>
					</div>
					<Skeleton size="sm" className="w-3/4" />
					<Skeleton size="sm" className="w-1/2" />
				</div>
				<div className={cn(ONBOARDING_PANEL_CLASS_NAME, "hidden space-y-5 p-5 lg:block")}>
					<Skeleton className="h-1.5 w-full" />
					{Array.from({ length: stepCount }, (_, index) => (
						<div key={index} className="flex items-center gap-3">
							<Skeleton variant="circular" className="size-8" />
							<div className="flex-1 space-y-1.5">
								<Skeleton size="sm" className="w-24" />
								<Skeleton size="sm" className="w-36" />
							</div>
						</div>
					))}
				</div>
			</div>
			<div className={cn(ONBOARDING_PANEL_CLASS_NAME, "space-y-6 p-5 sm:p-6")} aria-hidden="true">
				<div className="space-y-2 border-b border-border/70 pb-5">
					<Skeleton size="sm" className="w-20" />
					<Skeleton className="h-6 w-56" />
				</div>
				{Array.from({ length: SKELETON_FIELD_COUNT }, (_, index) => (
					<div key={index} className="space-y-2">
						<Skeleton size="sm" className="w-28" />
						<Skeleton className="h-11 w-full" />
					</div>
				))}
				<Skeleton className="ms-auto h-11 w-32" />
			</div>
		</div>
	);
}
