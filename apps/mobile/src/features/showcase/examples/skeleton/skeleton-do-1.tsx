import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

export function SkeletonDo1Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading profile">
			<View className="flex-row items-center gap-4">
				<Skeleton className="size-12 rounded-full" />
				<View className="gap-2">
					<Skeleton className="h-4 w-48 rounded-md" />
					<Skeleton className="h-4 w-36 rounded-md" />
				</View>
			</View>
		</SkeletonGroup>
	);
}
