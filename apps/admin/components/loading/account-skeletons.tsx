import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { FormSkeleton, ListSkeleton, PageHeaderSkeleton, ProseSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import type * as React from "react";

import { PROFILE_LOADING_LABELS, SECURITY_LOADING_LABELS } from "@/components/loading/loading-labels";
import { CardHeadingSkeleton } from "@/components/loading/skeleton-parts";

// ── Profile ──────────────────────────────────────────────────────────────────

/** `ProfileForm`: full name. */
const PROFILE_FORM_FIELDS = 1;

/** `/account/profile`: header, then the personal-details card — avatar + upload/remove, the name field, save. */
export function ProfilePageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={PROFILE_LOADING_LABELS} className="flex w-full flex-col gap-6">
			<PageHeaderSkeleton />
			<Card className="max-w-2xl">
				<CardHeader>
					<CardHeadingSkeleton />
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					<div data-skeleton="profile-avatar" className="flex items-center gap-4">
						<Skeleton variant="circular" className="size-16" />
						<div className="flex flex-col gap-2">
							<div className="flex gap-2">
								<Skeleton className="h-8 w-28" />
								<Skeleton className="h-8 w-20" />
							</div>
							<Skeleton variant="text" className="h-3 w-48" />
						</div>
					</div>
					<FormSkeleton surface="plain" fields={PROFILE_FORM_FIELDS} withActions={false} />
					<Skeleton className="h-9 w-32" />
				</CardContent>
			</Card>
		</SkeletonRegion>
	);
}

// ── Security ─────────────────────────────────────────────────────────────────

/** `ChangePasswordForm`: current, new, confirm. */
const CHANGE_PASSWORD_FIELDS = 3;
/** Signed-in device rows drawn while the sessions load. */
const SIGNED_IN_DEVICE_ROWS = 2;
/** Lines of explanatory copy in the two-factor and recovery sections. */
const SECURITY_PROSE_LINES = 2;

/** One `SecuritySettingsPanel` section: a bordered card-colored block with its `h2` + description. */
function SecuritySectionSkeleton({ wide, children }: { readonly wide: boolean; readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<div data-skeleton="security-section" className={cn("flex flex-col gap-4 rounded-xl border bg-card p-6", wide && "lg:col-span-2")}>
			<CardHeadingSkeleton />
			{children}
		</div>
	);
}

/**
 * `/account/security`: header, then the security grid — email verification,
 * change password beside two-factor, signed-in devices, MFA recovery.
 */
export function SecurityPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={SECURITY_LOADING_LABELS} className="flex flex-col gap-6">
			<PageHeaderSkeleton />
			<div className="grid gap-8 lg:grid-cols-2">
				<SecuritySectionSkeleton wide>
					<Skeleton variant="text" className="h-3.5 w-64 max-w-full" />
				</SecuritySectionSkeleton>
				<SecuritySectionSkeleton wide={false}>
					<FormSkeleton surface="plain" fields={CHANGE_PASSWORD_FIELDS} />
				</SecuritySectionSkeleton>
				<SecuritySectionSkeleton wide={false}>
					<ProseSkeleton lines={SECURITY_PROSE_LINES} />
					<Skeleton className="h-9 w-40" />
				</SecuritySectionSkeleton>
				<SecuritySectionSkeleton wide>
					<ListSkeleton surface="plain" leading="icon" rows={SIGNED_IN_DEVICE_ROWS} />
				</SecuritySectionSkeleton>
				<SecuritySectionSkeleton wide>
					<ProseSkeleton lines={SECURITY_PROSE_LINES} />
					<Skeleton className="h-9 w-40" />
				</SecuritySectionSkeleton>
			</div>
		</SkeletonRegion>
	);
}
