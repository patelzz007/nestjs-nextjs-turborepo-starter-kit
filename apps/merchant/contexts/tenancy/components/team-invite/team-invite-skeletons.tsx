"use client";

import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";

/** What the invitation announces while its link is checked. */
export const TEAM_INVITE_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Checking your invitation…" };

/** The invitation's detail rows: role, invited email, location access. */
const INVITE_DETAIL_ROWS = 3;

/**
 * The invitation preview's silhouette: the tenant's initials tile with
 * the "Join …" heading, the detail box and the expiry note. Bones only — wrap
 * it in one `SkeletonRegion`; it sits in the card's own vertical stack.
 */
export function TeamInvitePreviewSkeleton(): React.JSX.Element {
	return (
		<>
			<div className="flex items-start gap-4">
				<Skeleton className="size-14 rounded-2xl" />
				<div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
					<Skeleton className="h-7 w-64 max-w-full" />
					<Skeleton variant="text" className="h-3.5 w-80 max-w-full" />
				</div>
			</div>
			<div className="grid gap-4 rounded-xl border border-border/60 bg-muted/25 p-4 sm:p-5">
				{placeholderKeys("detail", INVITE_DETAIL_ROWS).map((key): React.JSX.Element => (
					<div key={key} data-slot="team-invite-detail-skeleton" className="flex items-start gap-3">
						<Skeleton className="size-8 rounded-lg" />
						<div className="flex min-w-0 flex-1 flex-col gap-1.5">
							<Skeleton variant="text" className="h-3 w-24" />
							<Skeleton variant="text" className="h-3.5 w-48 max-w-full" />
						</div>
					</div>
				))}
			</div>
			<div className="flex flex-col gap-2 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
				<Skeleton variant="text" className="h-3.5 w-full" />
				<Skeleton variant="text" className="h-3.5 w-1/2" />
			</div>
		</>
	);
}

/** The whole invitation card while the page reads its link: the badge, the preview and the footer buttons. */
export function TeamInviteCardSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={TEAM_INVITE_LOADING_LABELS}>
			<div className="overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-lg backdrop-blur-sm">
				<div className="h-1 bg-muted" />
				<div className="flex flex-col gap-6 p-6 sm:p-8">
					<div className="flex flex-col gap-4">
						<Skeleton className="h-6 w-36 rounded-full" />
						<TeamInvitePreviewSkeleton />
					</div>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<Skeleton className="h-9 w-full sm:w-32" />
						<Skeleton className="h-9 w-full sm:w-40" />
					</div>
				</div>
			</div>
		</SkeletonRegion>
	);
}
