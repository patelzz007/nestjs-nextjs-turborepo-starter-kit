import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type * as React from "react";

import { USER_LOADING_LABELS } from "@/components/loading/loading-labels";
import { BadgeSkeleton, CardHeadingSkeleton, LabelledValueGridSkeleton } from "@/components/loading/skeleton-parts";

/** `UserProfileOverview`'s sections in render order, with how many fields each shows and whether it has a description. */
const USER_PROFILE_SECTIONS: readonly { readonly key: string; readonly fields: number; readonly withDescription: boolean }[] = [
	{ key: "identity", fields: 3, withDescription: false },
	{ key: "signup-referral", fields: 2, withDescription: true },
	{ key: "account-status", fields: 6, withDescription: true },
	{ key: "security", fields: 4, withDescription: true },
	{ key: "audit", fields: 2, withDescription: false },
];
/** Requested, reviewed — the facts every recovery request shows. */
const MFA_REQUEST_FACTS = 2;
/** Assigned roles drawn under the access tabs. */
const USER_ACCESS_ROLE_ROWS = 2;

/** One recovery request (`MfaRecoveryReviewPanel`): who asked, its status, when it was requested and reviewed. */
export function MfaRecoveryRequestSkeleton(): React.JSX.Element {
	return (
		<div data-skeleton="mfa-recovery-request" className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-col gap-1.5">
					<Skeleton variant="text" className="h-3.5 w-32" />
					<Skeleton variant="text" className="h-3 w-44" />
				</div>
				<BadgeSkeleton />
			</div>
			<LabelledValueGridSkeleton count={MFA_REQUEST_FACTS} className="gap-3 sm:grid-cols-2" />
		</div>
	);
}

/**
 * `/users/[id]`: the avatar + name + email header (+ "Impersonate user"),
 * then the profile overview card, the MFA recovery card and the access card.
 */
export function UserDetailPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={USER_LOADING_LABELS} className="mx-auto flex w-full flex-col gap-6">
			<div data-skeleton="user-detail-header" className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<Skeleton variant="circular" className="size-14" />
					<div className="flex min-w-0 flex-col gap-2">
						<Skeleton className="h-7 w-48" />
						<Skeleton variant="text" className="h-4 w-56" />
					</div>
				</div>
				<Skeleton className="h-8 w-36" />
			</div>
			<Card>
				<CardHeader>
					<CardHeadingSkeleton />
				</CardHeader>
				<CardContent className="flex flex-col gap-8">
					{USER_PROFILE_SECTIONS.map((section) => (
						<div key={section.key} data-skeleton="user-profile-section" className="flex flex-col gap-3">
							<div className="flex flex-col gap-1.5">
								<Skeleton variant="text" className="h-3.5 w-28" />
								{section.withDescription ? <Skeleton variant="text" className="h-3 w-80 max-w-full" /> : null}
							</div>
							<LabelledValueGridSkeleton count={section.fields} className="sm:grid-cols-2" />
						</div>
					))}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardHeadingSkeleton />
				</CardHeader>
			</Card>
			<Card>
				<CardHeader>
					<CardHeadingSkeleton />
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Skeleton className="h-10 w-full" />
					{placeholderKeys("role", USER_ACCESS_ROLE_ROWS).map((key) => (
						<div key={key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
							<div className="flex flex-col gap-1.5">
								<Skeleton variant="text" className="h-3.5 w-28" />
								<Skeleton variant="text" className="h-3 w-48" />
							</div>
							<Skeleton className="h-8 w-20" />
						</div>
					))}
				</CardContent>
			</Card>
		</SkeletonRegion>
	);
}
