import { Separator } from "@workspace/ui-native/components/separator";
import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

/** How many placeholder rows the example repeats. */
const ROW_COUNT = 3;
/** A stable id per placeholder, used as its key. */
const ROW_IDS: readonly string[] = Array.from({ length: ROW_COUNT }, (_: undefined, position: number): string => `rows-${String(position + 1)}`);

export function Skeleton7Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading members">
			<View>
				<View className="flex-row items-center justify-between pb-4">
					<Skeleton className="h-5 w-28 rounded-md" />
					<Skeleton className="h-9 w-20 rounded-full" />
				</View>
				<Separator />
				{ROW_IDS.map((id: string): React.JSX.Element => (
					<View key={id} className="flex-row items-center gap-3 border-b border-border py-3">
						<Skeleton className="size-9 rounded-full" />
						<View className="flex-1 gap-1.5">
							<Skeleton className="h-3.5 w-32 rounded-md" />
							<Skeleton className="h-3 w-40 rounded-md" />
						</View>
						<Skeleton className="h-7 w-16 rounded-full" />
					</View>
				))}
			</View>
		</SkeletonGroup>
	);
}
