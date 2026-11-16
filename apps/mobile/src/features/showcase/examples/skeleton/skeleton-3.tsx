import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

export function Skeleton3Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading article">
			<View className="gap-2">
				<Skeleton className="h-4 w-full rounded-md" />
				<Skeleton className="h-4 w-full rounded-md" />
				<Skeleton className="h-4 w-3/4 rounded-md" />
				<View className="mt-4 gap-2">
					<Skeleton className="h-4 w-full rounded-md" />
					<Skeleton className="h-4 w-5/6 rounded-md" />
				</View>
			</View>
		</SkeletonGroup>
	);
}
