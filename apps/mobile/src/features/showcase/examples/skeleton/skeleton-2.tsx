import { Card, CardContent, CardHeader } from "@workspace/ui-native/components/card";
import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";

export function Skeleton2Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading card">
			<Card>
				<CardHeader className="gap-2">
					<Skeleton className="h-4 w-2/3 rounded-md" />
					<Skeleton className="h-4 w-1/2 rounded-md" />
				</CardHeader>
				<CardContent>
					<Skeleton className="aspect-video w-full rounded-md" />
				</CardContent>
			</Card>
		</SkeletonGroup>
	);
}
