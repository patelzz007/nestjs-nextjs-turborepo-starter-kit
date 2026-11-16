import * as React from "react";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";

/** How many placeholder rows the example repeats. */
const ROW_COUNT = 3;
/** A stable id per placeholder row, used as its key. */
const ROW_IDS: readonly string[] = Array.from({ length: ROW_COUNT }, (_: undefined, position: number): string => `row-${String(position + 1)}`);

export function Skeleton7Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			{/* Skeleton pattern */}
			<div className="flex flex-col">
				<div className="flex items-center justify-between pb-4">
					<Skeleton className="h-5 w-28" />
					<Skeleton className="h-8 w-20 rounded-md" />
				</div>
				<Separator className="opacity-60" />
				{ROW_IDS.map((placeholderId: string): React.JSX.Element => (
					<div key={placeholderId} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-b-0">
						<Skeleton className="size-9 shrink-0 rounded-full" />
						<div className="flex flex-1 flex-col gap-1.5">
							<Skeleton className="h-3.5 w-32" />
							<Skeleton className="h-3 w-48" />
						</div>
						<Skeleton className="h-7 w-16 rounded-md" />
					</div>
				))}
			</div>
		</div>
	);
}
