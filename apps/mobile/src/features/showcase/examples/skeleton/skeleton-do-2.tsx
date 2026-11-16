import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

export function SkeletonDo2Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading invoices">
			<View className="gap-3">
				<Skeleton className="h-4 w-full rounded-md" />
				<Skeleton className="h-4 w-full rounded-md" />
				<Skeleton className="h-4 w-2/3 rounded-md" />
			</View>
		</SkeletonGroup>
	);
}
