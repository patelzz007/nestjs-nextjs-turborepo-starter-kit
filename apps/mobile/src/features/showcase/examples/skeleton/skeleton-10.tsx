import { Card, CardContent } from "@workspace/ui-native/components/card";
import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

export function Skeleton10Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading messages">
			<Card>
				<CardContent className="gap-4">
					<View className="flex-row items-start gap-2.5">
						<Skeleton className="size-8 rounded-full" />
						<View className="gap-1">
							<Skeleton className="h-3 w-16 rounded-md" />
							<Skeleton className="h-16 w-48 rounded-lg rounded-tl-none" />
							<Skeleton className="h-2.5 w-12 rounded-md" />
						</View>
					</View>
					<View className="items-end gap-1">
						<Skeleton className="h-10 w-40 rounded-lg rounded-tr-none" />
						<Skeleton className="h-2.5 w-12 rounded-md" />
					</View>
					<View className="flex-row items-start gap-2.5">
						<Skeleton className="size-8 rounded-full" />
						<View className="gap-1">
							<Skeleton className="h-3 w-20 rounded-md" />
							<Skeleton className="h-24 w-56 rounded-lg rounded-tl-none" />
							<Skeleton className="h-2.5 w-12 rounded-md" />
						</View>
					</View>
					<View className="flex-row items-center gap-2 pt-2">
						<Skeleton className="h-11 flex-1 rounded-full" />
						<Skeleton className="size-11 rounded-full" />
					</View>
				</CardContent>
			</Card>
		</SkeletonGroup>
	);
}
