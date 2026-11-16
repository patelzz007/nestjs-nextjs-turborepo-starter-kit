import * as React from "react";
import { Skeleton } from "@workspace/ui/components/skeleton";

export function SkeletonDo2Example(): React.JSX.Element {
	return (
		<div role="status" aria-label="Loading the member list" className="flex flex-col gap-2">
			<Skeleton className="h-4 w-48" />
			<Skeleton className="h-4 w-40" />
			<Skeleton className="h-4 w-44" />
		</div>
	);
}
