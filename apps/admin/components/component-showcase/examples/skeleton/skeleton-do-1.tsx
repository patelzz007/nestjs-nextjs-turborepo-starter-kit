import * as React from "react";
import { Skeleton } from "@workspace/ui/components/skeleton";

export function SkeletonDo1Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-3">
			<Skeleton className="size-10 rounded-full" />
			<div className="flex flex-col gap-2">
				<Skeleton className="h-4 w-40" />
				<Skeleton className="h-3 w-28" />
			</div>
		</div>
	);
}
