import * as React from "react";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";

/** How many placeholder stats the profile header repeats. */
const STAT_COUNT = 3;
/** A stable id per placeholder stat, used as its key. */
const STAT_IDS: readonly string[] = Array.from({ length: STAT_COUNT }, (_: undefined, position: number): string => `stat-${String(position + 1)}`);

/** How many placeholder rows the example repeats. */
const DETAIL_ROW_COUNT = 4;
/** A stable id per placeholder row, used as its key. */
const DETAIL_ROW_IDS: readonly string[] = Array.from({ length: DETAIL_ROW_COUNT }, (_: undefined, position: number): string => `row-${String(position + 1)}`);

export function Skeleton9Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs space-y-6">
			{/* Profile header */}
			<Card>
				<CardHeader className="items-center gap-3">
					<Skeleton className="size-20 rounded-full" />
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-3 w-48" />
				</CardHeader>
				<CardContent className="flex justify-center gap-8">
					{STAT_IDS.map((placeholderId: string): React.JSX.Element => (
						<div key={placeholderId} className="flex flex-col items-center gap-1">
							<Skeleton className="h-5 w-10" />
							<Skeleton className="h-3 w-14" />
						</div>
					))}
				</CardContent>
			</Card>

			{/* Details section */}
			<Card>
				<CardContent className="space-y-4 pt-4">
					<Skeleton className="h-4 w-24" />
					<Separator />
					{DETAIL_ROW_IDS.map((placeholderId: string): React.JSX.Element => (
						<div key={placeholderId} className="flex items-center justify-between">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-32" />
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}
