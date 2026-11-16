import * as React from "react";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";

/** How many placeholder cards the example repeats. */
const CARD_COUNT = 3;
/** A stable id per placeholder card, used as its key. */
const CARD_IDS: readonly string[] = Array.from({ length: CARD_COUNT }, (_: undefined, position: number): string => `card-${String(position + 1)}`);

export function Skeleton6Example(): React.JSX.Element {
	return (
		<div className="mx-auto grid w-full max-w-lg grid-cols-3 gap-4">
			{CARD_IDS.map((placeholderId: string): React.JSX.Element => (
				<Card key={placeholderId}>
					<CardHeader className="pb-2">
						<Skeleton className="h-3 w-16" />
					</CardHeader>
					<CardContent className="space-y-2">
						<Skeleton className="h-7 w-24" />
						<Skeleton className="h-3 w-20" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}
