import { Skeleton } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

// Bones outside a group: nothing tells a screen reader that anything is loading.
export function SkeletonDont2Example(): React.JSX.Element {
	return (
		<View className="gap-3">
			<Skeleton className="h-4 w-full rounded-md" />
			<Skeleton className="h-4 w-full rounded-md" />
			<Skeleton className="h-4 w-2/3 rounded-md" />
		</View>
	);
}
