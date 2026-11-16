import * as React from "react";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";

export function Skeleton2Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader className="gap-2">
				<Skeleton className="h-4 w-2/3" />
				<Skeleton className="h-4 w-1/2" />
			</CardHeader>
			<CardContent>
				<Skeleton className="aspect-video w-full rounded-md" />
			</CardContent>
		</Card>
	);
}
