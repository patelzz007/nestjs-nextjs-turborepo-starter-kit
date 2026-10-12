import { IMPERSONATION_USERS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { cycledWidth, placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** About what the panel's `max-h-48` list shows before it scrolls. */
const USER_SKELETON_ROWS = 3;

const NAME_WIDTHS: readonly string[] = ["w-32", "w-40", "w-28"];
const EMAIL_WIDTHS: readonly string[] = ["w-44", "w-36", "w-48"];

/** The impersonation panel's user list while the first page loads — name and email per row, then "Impersonate". */
export function ImpersonationUsersSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={IMPERSONATION_USERS_LOADING_LABELS}>
			<div className="divide-y rounded-md border">
				{placeholderKeys("user", USER_SKELETON_ROWS).map((key, index) => (
					<div key={key} data-slot="impersonation-user-row-skeleton" className="flex items-center justify-between gap-3 px-3 py-2">
						<div className="flex min-w-0 flex-col">
							<Skeleton variant="text" className={cn("my-0.5 h-4", cycledWidth(NAME_WIDTHS, index, "w-32"))} />
							<Skeleton variant="text" className={cn("my-0.5 h-3", cycledWidth(EMAIL_WIDTHS, index, "w-44"))} />
						</div>
						<Skeleton className="h-9 w-28" />
					</div>
				))}
			</div>
		</SkeletonRegion>
	);
}
