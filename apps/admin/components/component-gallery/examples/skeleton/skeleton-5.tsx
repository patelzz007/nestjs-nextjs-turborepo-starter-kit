import * as React from "react";
import { Skeleton } from "@workspace/ui/components/skeleton";

/** How many placeholder rows the example repeats. */
const ROW_COUNT = 4;
/** A stable id per placeholder row, used as its key. */
const ROW_IDS: readonly string[] = Array.from({ length: ROW_COUNT }, (_: undefined, position: number): string => `row-${String(position + 1)}`);

export function Skeleton5Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-4">
			<div className="flex gap-4 border-b pb-2">
				<Skeleton className="h-4 flex-1" />
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-20" />
			</div>
			{ROW_IDS.map((placeholderId: string): React.JSX.Element => (
				<div key={placeholderId} className="flex gap-4">
					<Skeleton className="h-4 flex-1" />
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-4 w-20" />
				</div>
			))}
		</div>
	);
}
