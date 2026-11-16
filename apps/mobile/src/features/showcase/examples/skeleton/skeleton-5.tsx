import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

/** How many placeholder rows the example repeats. */
const ROW_COUNT = 4;
/** A stable id per placeholder, used as its key. */
const ROW_IDS: readonly string[] = Array.from({ length: ROW_COUNT }, (_: undefined, position: number): string => `rows-${String(position + 1)}`);

export function Skeleton5Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading table">
			<View className="gap-4">
				<View className="flex-row gap-4 border-b border-border pb-2">
					<Skeleton className="h-4 flex-1 rounded-md" />
					<Skeleton className="h-4 w-24 rounded-md" />
					<Skeleton className="h-4 w-20 rounded-md" />
				</View>
				{ROW_IDS.map((id: string): React.JSX.Element => (
					<View key={id} className="flex-row gap-4">
						<Skeleton className="h-4 flex-1 rounded-md" />
						<Skeleton className="h-4 w-24 rounded-md" />
						<Skeleton className="h-4 w-20 rounded-md" />
					</View>
				))}
			</View>
		</SkeletonGroup>
	);
}
