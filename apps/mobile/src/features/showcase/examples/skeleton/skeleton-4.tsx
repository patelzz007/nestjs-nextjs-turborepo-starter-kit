import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

export function Skeleton4Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading form">
			<View className="gap-6">
				<View className="gap-2">
					<Skeleton className="h-4 w-20 rounded-md" />
					<Skeleton className="h-12 w-full rounded-md" />
				</View>
				<View className="gap-2">
					<Skeleton className="h-4 w-24 rounded-md" />
					<Skeleton className="h-12 w-full rounded-md" />
				</View>
				<Skeleton className="h-12 w-28 rounded-md" />
			</View>
		</SkeletonGroup>
	);
}
