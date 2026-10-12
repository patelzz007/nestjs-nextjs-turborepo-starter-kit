import { PROFILE_LOADING_LABELS } from "@/components/loading/loading-labels";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import * as React from "react";

/**
 * `/hello` while the profile loads — the view's centred column: breadcrumb,
 * avatar, welcome heading and email, status badges, the collapsed "Account
 * Details" card and the sign-out button.
 */
export function HelloProfileSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={PROFILE_LOADING_LABELS}>
			<div className="flex min-h-svh flex-col">
				<div className="flex flex-1 items-center justify-center p-8">
					<div className="w-full max-w-lg space-y-8">
						<Skeleton variant="text" className="h-5 w-40" />
						<div className="flex flex-col items-center">
							<Skeleton variant="circular" className="size-16" />
							<Skeleton className="mt-4.5 mb-0.5 h-7 w-56" />
							<Skeleton variant="text" className="mt-1.5 mb-0.5 h-4 w-44" />
						</div>
						<div className="flex justify-center gap-2">
							<Skeleton variant="text" className="h-5 w-24" />
							<Skeleton variant="text" className="h-5 w-20" />
						</div>
						<div className="rounded-lg border bg-card p-6 shadow-xs">
							<Skeleton variant="text" className="h-5 w-full" />
						</div>
						<div className="flex justify-center">
							<Skeleton className="h-10 w-28" />
						</div>
					</div>
				</div>
			</div>
		</SkeletonRegion>
	);
}
