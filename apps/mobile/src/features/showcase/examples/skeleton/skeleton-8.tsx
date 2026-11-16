import { Card, CardContent, CardFooter, CardHeader } from "@workspace/ui-native/components/card";
import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";

export function Skeleton8Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading card">
			<Card>
				<CardHeader>
					<Skeleton className="aspect-video w-full rounded-md" />
				</CardHeader>
				<CardContent className="gap-2">
					<Skeleton className="h-4 w-3/4 rounded-md" />
					<Skeleton className="h-3 w-full rounded-md" />
					<Skeleton className="h-3 w-2/3 rounded-md" />
				</CardContent>
				<CardFooter className="justify-between">
					<Skeleton className="h-9 w-20 rounded-full" />
					<Skeleton className="size-9 rounded-full" />
				</CardFooter>
			</Card>
		</SkeletonGroup>
	);
}
