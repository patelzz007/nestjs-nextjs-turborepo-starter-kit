import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface RewardHubPageHeaderSkeletonProps {
	readonly className?: string;
}

/**
 * Bones for `WebPageHeader` — eyebrow, `h1`, subtitle over the bottom rule.
 * Each bone's height plus its margin equals the real line box (`text-xs` 16px,
 * `text-2xl`/`sm:text-3xl` 32/36px, `text-sm` 20px), so the header keeps its height.
 */
export function RewardHubPageHeaderSkeleton({ className }: RewardHubPageHeaderSkeletonProps): React.JSX.Element {
	return (
		<div className={cn("flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5", className)}>
			<div className="flex w-full max-w-2xl flex-col gap-1">
				<Skeleton variant="text" className="my-0.5 h-3 w-20" />
				<Skeleton className="my-0.5 h-7 w-64 max-w-full sm:h-8" />
				<Skeleton variant="text" className="my-0.5 h-4 w-full max-w-md" />
			</div>
		</div>
	);
}

/** Bones for the ghost "Back to …" link under a `WebPageHeader` (a `sm` button, pulled up by `-mt-4`). */
export function RewardHubBackLinkSkeleton(): React.JSX.Element {
	return <Skeleton className="-mt-4 h-9 w-32" />;
}
