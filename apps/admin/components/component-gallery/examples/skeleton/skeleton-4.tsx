import * as React from "react";
import { Skeleton } from "@workspace/ui/components/skeleton";

export function Skeleton4Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			{/* Skeleton pattern */}
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-10 w-full" />
				</div>
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-10 w-full" />
				</div>
				<Skeleton className="h-10 w-28" />
			</div>
		</div>
	);
}
