import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";

// One grey slab where a face and two lines will appear: the screen still jumps when they arrive.

export function SkeletonDont1Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading profile">
			<Skeleton className="h-40 w-full rounded-md" />
		</SkeletonGroup>
	);
}
