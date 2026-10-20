// The place a till view (pairing or counter) holds while its module loads: a
// card's title, its text field and its scan button. Both views are loaded
// lazily with the camera scanner they open (till-pairing.tsx, till-counter.tsx).

import { Skeleton, SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import * as React from "react";

import { TILL_COPY } from "./labels";

export function TillViewSkeleton(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel={TILL_COPY.loading} testID="till-view-skeleton" className="gap-3 rounded-xl bg-card p-4">
			<SkeletonText size="lg" widthClassName="w-1/2" />
			<SkeletonText size="sm" widthClassName="w-5/6" />
			<Skeleton className="h-12 w-full rounded-lg" />
			<Skeleton className="h-12 w-full rounded-lg" />
		</SkeletonGroup>
	);
}
